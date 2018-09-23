import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import * as firebase from 'firebase/app';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFireStorage } from 'angularfire2/storage';

import { Observable, Subject, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { Note, Todo } from './Note';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar  } from '@angular/material';

export const STORAGE_IMAGE_FOLDER = 'images';
export const STORAGE_VIDEO_FOLDER = 'videos';

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'
const TINIFY_API_SHRINK = 'https://api.tinify.com/shrink';
const TINIFY_API_AUTH = 'Basic YXBpOlRGOUoyd1hKUzF3aW56OWtiekNIZnZJcmNRMnIyb2s0';

@Injectable()
export class NoteService implements OnDestroy {

  items$: Observable<any[]>;

  user: Observable<firebase.User>;
  userName: string;
  isOwner = false;

  // firestore
  private collection: AngularFirestoreCollection<any>;
  stateChanges: Observable<any[]>;
  lastChanged = { $key: '', $type: '' };
  toSave = { $key: '', $type: '', index: -1 }; // item to save for add / edit
  theNote: any; // to add or edit
  get theNoteHasImage() { return this.theNote && this.theNote.imageURL; }

  subscription: Subscription = null;
  subStateChange: Subscription;

  private lastSaved$ = new Subject<any>();
  announcedLastSaved = this.lastSaved$.asObservable();

  countNotes = 0;
  private listStateInternal = 'none'; // none, added, modified, removed
  listState = 'none';

  todo: Todo = Todo.List;

  get loggedin() { return !!this.userName; }

  constructor(
    private http: HttpClient,
    private afAuth: AngularFireAuth,
    private storage: AngularFireStorage,
    private afs: AngularFirestore,
    public snackBar: MatSnackBar) {
    console.warn(`'note.service'`); // watch when / how often the service is instantiated

    this.user = afAuth.authState;
    afAuth.auth.onAuthStateChanged(user => {
      if (user) {
        console.log('logged in', user);
        this.userName = user.displayName || 'Anonymous';
        this.isOwner = !user.isAnonymous && user.email === 'bob.bumsuk.lee@gmail.com';

        this.initAfterLogin();
      } else {
        console.log('logged out');
        this.userName = '';
      }
    });

    this.login();

    // observables for firestore
    this.collection = this.afs.collection(`notes`, ref => ref.orderBy('updatedAt', 'desc'));

    // filter out 'modified' state change due to firestore timestamp being set for newly-added note
    this.stateChanges = this.collection.stateChanges().pipe(
      map(actions => actions.filter(action =>
        (action.type === 'modified' &&
          action.payload.doc.id === this.lastChanged.$key &&
          this.lastChanged.$type === 'added') ? false : true
      )));

    this.subStateChange = this.stateChanges.subscribe(actions => actions.map(action => {
      // console.log('stateChange', action.payload);
      this.lastChanged = {
        $key: action.payload.doc.id,
        $type: action.type
      };
      this.listStateInternal = action.type;

      this.announceLastSaved(this.lastChanged.$key, this.lastChanged.$type, action.payload.newIndex);
      setTimeout(_ => this.lastChanged.$type = '', 2000);
    }));

    this.items$ = this.collection.snapshotChanges().pipe(
      map(actions => { // why hits twice on page change?
        this.countNotes = actions.length;
        console.log('snapshotChanges', this.countNotes);
        if (this.countNotes === 0) {
          return actions;
        }

        return actions.map(action => {
          const { updatedAt, ...rest } = action.payload.doc.data();
          this.listState = this.listStateInternal;

          return {
            $key: action.payload.doc.id,
            $type: action.type,
            updatedAt: updatedAt && updatedAt.toDate(),
            ...rest
          };
        })
      }));

  }

  ngOnDestroy() {
    console.warn(`'note.service' ngOnDestroy()`);
    if (this.subscription && !this.subscription.closed) this.subscription.unsubscribe();
  }

  step1 = false;
  stepOne() {
    this.step1 = true;
    setTimeout(_ => this.step1 = false, 1500);
  }
  stepTwo() {
    if (this.step1) {
      this.logoutin();
    }
  }
  async logoutin() {
    if (this.isOwner) {
      await this.logout();
      await this.loginAnonymous();
    } else {
      await this.logout();
      await this.loginGoogle();
    }
  }

  private announceLastSaved($key, $type, index): void {
    if ($type === 'removed' || $type !== this.toSave.$type) return;
    if ($type === 'modified' && $key !== this.toSave.$key) return;

    if ($type === 'added') {
      this.toSave.$key = $key;
      this.toSave.index = index;
    } else {
      this.lastSaved$.next({ $key, $type, index });
      this.toSave.$key = '';
      this.toSave.$type = '';
    }
  }

  initAfterLogin() {
  }

  async login() {
    await this.loginAnonymous();
  }

  async loginAnonymous() {
    await this.afAuth.auth.signInAnonymously();
  }
  
  async loginGoogle() {
    await this.afAuth.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  async logout() {
    if (this.subscription && !this.subscription.closed) this.subscription.unsubscribe();
    await this.afAuth.auth.signOut();
  }

  async removeNote(note): Promise<void> {
    console.log('removeNote', note.$key);
    await this.collection.doc(note.$key).delete();
    console.log('removed');
  }

  async save(noteToSave: any, files, imageFailedToLoad: boolean, toTinify: boolean, toRemoveExistingImage?: boolean): Promise<any> {
    console.log(`save ${Todo[this.todo]}, imageFailedToLoad=${imageFailedToLoad}, toRemoveExistingImage=${toRemoveExistingImage}`);

    const note = noteToSave || this.theNote;

    // console.log('note', note);

    if (this.todo === Todo.Add) { // add

      if (files && files.length > 0) {
        const file = files.item(0);
        if (file) {
          console.log('file', file);

          await this.putImage(file, note, toTinify);
        }
      }

      return this.saveNew(note);

    } else if (this.todo === Todo.Edit) { // edit

      return this.saveEdit(note, files, imageFailedToLoad, toTinify, toRemoveExistingImage);

    } else if (this.todo === Todo.Remove) { // remove

      return this.removeNote(note);
    }
  }

  /* 5 edit cases for image:

      previous      current				action          description
  ----+-------------+-------------+---------------+---------------------------
  1a.	no image      no image			x               null imageURL, no file
  1b.               new image			add             null imageURL, new file
  2a.	image         same          x               imageURL, no file
  2b.               no image			remove          imageURL, toRemove, no file
  2c.               new image			remove and add  imageURL, (toRemove), new file
  ----+-------------+-------------+---------------+---------------------------
  */
  private async saveEdit(note: any, files, imageFailedToLoad: boolean, toTinify: boolean, toRemoveExistingImage?: boolean): Promise<any> {
    this.toSave = { $key: note.$key, $type: 'modified', index: -1 };

    const imageURL = note.imageURL;
    if (imageURL) { // existing image
      console.log(`saveEdit(${imageURL}`);

      if (!toRemoveExistingImage && (!files || files.length === 0)) {
        console.log('case 2a.');

        if (imageFailedToLoad) {
          note.imageURL = null;
          note.thumbURL = null;
        }

      } else if (toRemoveExistingImage && (!files || files.length === 0)) {
        console.log('case 2b.');

        console.log('finally');
        note.imageURL = null;
        note.thumbURL = null;
      } else if (files && files.length > 0) {
        console.log('case 2c.');
        const file = files.item(0);

        note.thumbURL = null;

        console.log('finally');
        if (file) {
          await this.putImage(file, note, toTinify);
        }
      }
    } else { // no existing image

      if (!files || files.length === 0) {
        console.log('case 1a.');
      } else if (files && files.length > 0) {
        console.log('case 1b.');

        const file = files.item(0);
        if (file) {
          console.log('selected file', file);
          await this.putImage(file, note, toTinify);
        }
      }
    }

    return this.update(note);
  }

  private async putImage(file: any, note: any, toTinify: boolean): Promise<boolean> {
    try {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const destination = isImage ? STORAGE_IMAGE_FOLDER :
        isVideo ? STORAGE_VIDEO_FOLDER : '';
      if (!destination) {
        throw `invalid file type '${file.type}'`;
      }

      let url: string;
      let fileToUpload: File;

      if (isImage && toTinify) {
        try {
          await this.postTinify(file).pipe(take(1))
            .forEach((result) => { 
              url = result.output.url;
              console.log('postTinify', url);
            });
          
          await this.getTinifiedImage(url).pipe(take(1))
            .forEach((blob) => fileToUpload = new File([blob], file.name, { type: blob.type }));
        } catch (error) {
          console.error('putImage failed to tinify:', error);
          fileToUpload = file; // continue with original image
        }
      } else {
        fileToUpload = file;
      }
      
      const orientation = isImage ? await this.getOrientation(fileToUpload): -99;
      if (isImage) console.log(`image orientation ${orientation}, ${fileToUpload.size}, ${fileToUpload.type}`);
      
      const snapshot = await this.storage.ref(`${destination}/${fileToUpload.name}`).put(fileToUpload);
      const downloadURL = await snapshot.ref.getDownloadURL();
      console.log('file uploaded:', downloadURL);
      note.imageURL = downloadURL;
      note.orientation = orientation;
      return true;
    } catch (error) {
      console.error('putImage failed:', error);
      return false;
    }
  }

  private postTinify(file): Observable<any> {
    const options = {
      headers: new HttpHeaders({
        'Authorization': TINIFY_API_AUTH,
      })
    };
    return this.http.post<any>(CORS_PROXY + TINIFY_API_SHRINK, file, options)
  }

  private getTinifiedImage(url: string): Observable<Blob> {
    return this.http.get(CORS_PROXY + url, {
      headers: new HttpHeaders({
        'Authorization': TINIFY_API_AUTH,
        'Accept': 'image/*'
      }),
      responseType: 'blob'
    });
  }

  private getOrientation(file: any): Promise<number> {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = function (e) {
        const view = new DataView(reader.result);
        console.log(`reader got ${view.byteLength} bytes: ${view.getUint8(0)},${view.getUint8(1)},${view.getUint8(2)},${view.getUint8(3)},${view.getUint8(4)},${view.getUint8(5)}...`);
        if (view.getUint16(0, false) != 0xFFD8) {
          resolve(-2);
        }
        let length = view.byteLength, offset = 2;
        while (offset < length) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker == 0xFFE1) {
            if (view.getUint32(offset += 2, false) != 0x45786966) {
              resolve(-1);
            }
            const little = view.getUint16(offset += 6, false) == 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;
            for (let i = 0; i < tags; i++)
              if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                const o = view.getUint16(offset + (i * 12) + 8, little);
                resolve(o);
              }
          }
          else if ((marker & 0xFF00) != 0xFF00) break;
          else offset += view.getUint16(offset, false);
        }
        resolve(-1);
      };

      reader.readAsArrayBuffer(file);
    });
  }

  private async saveNew(note: Note): Promise<any> {
    console.log('saveNew');

    this.toSave = { $key: '', $type: 'added', index: -1 };
    const ref = await this.collection.add(note);
    if (this.toSave.$key === ref.id) {
      this.lastSaved$.next({ $key: ref.id, $type: 'added', index: this.toSave.index });
    }
    return ref;
  }

  setTheNote(note?: any) { // to be called by user of FormModalComponent
    if (note && note.$key) { // edit
      this.theNote = {
        $key: note.$key, // needed?
        name: note.name,
        text: note.text,
        updatedAt: note.updatedAt,
        imageURL: note.imageURL || '',
        orientation: note.orientation || 1
      };
      this.todo = Todo.Edit;
    } else { // add
      this.theNote = {
        name: '',
        text: '',
        updatedAt: firebase['firestore'].FieldValue.serverTimestamp(),
        imageURL: '',
        orientation: 1
      };
      this.todo = Todo.Add;
    }
  }

  private async update(note): Promise<void> {
    const key = note.$key;
    delete note.$key;
    await this.collection.doc(key).update(note);
  }

  openSnackBar(message: string, action: string, duration = 3000): MatSnackBarRef<SimpleSnackBar> {
    return this.snackBar.open(message, action, {
      duration,
    });
  }

  resetListState() {
    this.listState = 'none';
  }

}