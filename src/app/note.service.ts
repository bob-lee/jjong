import { Injectable, OnDestroy } from '@angular/core';
//import { CanActivate, Router } from '@angular/router';

import * as firebase from 'firebase/app';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFireStorage } from 'angularfire2/storage';

import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { first, map, switchMap } from 'rxjs/operators';

import { Note, Todo, LoginWith } from './Note';

export const STORAGE_IMAGE_FOLDER = 'images';
export const STORAGE_VIDEO_FOLDER = 'videos';

@Injectable()
export class NoteService implements OnDestroy {

  notes$: Observable<any[]>;

  user: Observable<firebase.User>;
  userName: string;

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

  todo: Todo = Todo.List;

  get loggedin() { return !!this.userName; }

  constructor(
    private afAuth: AngularFireAuth,
    private storage: AngularFireStorage,
    private afs: AngularFirestore) {
    console.warn(`'note.service'`); // watch when / how often the service is instantiated

    this.user = afAuth.authState;
    afAuth.auth.onAuthStateChanged(user => {
      if (user) {
        console.log('logged in', user);
        this.userName = user.displayName || 'Anonymous';

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

      this.announceLastSaved(this.lastChanged.$key, this.lastChanged.$type, action.payload.newIndex);
      setTimeout(_ => this.lastChanged.$type = '', 2000);
    }));

    this.notes$ = this.collection.snapshotChanges().pipe(
      map(actions => { // why hits twice on page change?
        this.countNotes = actions.length;
        console.log('snapshotChanges', this.countNotes);
        if (this.countNotes === 0) {
          return actions;
        }

        return actions.map(action => {
          const { updatedAt, ...rest } = action.payload.doc.data();

          return {
            $key: action.payload.doc.id,
            $type: action.type,
            updatedAt: updatedAt && updatedAt.toDate(),
            ...rest
          };
        })
      }));

  }

  // canActivate(): Observable<boolean> {
  //   return this.user.map(auth => !!auth);
  // }

  ngOnDestroy() {
    console.warn(`'note.service' ngOnDestroy()`);
    if (this.subscription && !this.subscription.closed) this.subscription.unsubscribe();
  }

  getGroupNotes(): Observable<any[]> { // to be called once entering the group
    console.log(`getGroupNotes()`);
    return this.notes$;
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

  getState(note: any): string {
    if (note.$type === 'added') {
      return 'added';
    } else if (note.$type === 'modified' && this.lastChanged.$key === note.$key && this.lastChanged.$type === 'modified') {
      return 'modified'; // animate it
    } else {
      return 'void';
    }
  }

  initAfterLogin() {
    this.search();
  }

  async login() {
    await this.loginAnonymous();
  }

  async loginAnonymous() {
    await this.afAuth.auth.signInAnonymously();
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

  async save(noteToSave: any, files, imageFailedToLoad: boolean, toRemoveExistingImage?: boolean): Promise<any> {
    console.log(`save ${Todo[this.todo]}, imageFailedToLoad=${imageFailedToLoad}, toRemoveExistingImage=${toRemoveExistingImage}`);

    const note = noteToSave || this.theNote;

    // console.log('note', note);

    if (this.todo === Todo.Add) { // add

      if (files && files.length > 0) {
        const file = files.item(0);
        if (file) {
          console.log('file', file);

          await this.putImage(file, note);
          // try {
          //   const snapshot = await this.storage.child(`${STORAGE_IMAGE_FOLDER}/${file.name}`).put(file);
          //   console.log('uploaded file:', snapshot.downloadURL);
          //   note.imageURL = snapshot.downloadURL;
          // } catch (error) {
          //   console.error('failed to upload', error);
          // }
        }
      }

      return this.saveNew(note);

    } else if (this.todo === Todo.Edit) { // edit

      return this.saveEdit(note, files, imageFailedToLoad, toRemoveExistingImage);

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
  private async saveEdit(note: any, files, imageFailedToLoad: boolean, toRemoveExistingImage?: boolean): Promise<any> {
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
          await this.putImage(file, note);
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
          await this.putImage(file, note);
        }
      }
    }

    return this.update(note);
  }

  private async putImage(file: any, note: any): Promise<boolean> {
    try {
      const destination = file.type.startsWith('image/') ? STORAGE_IMAGE_FOLDER :
        file.type.startsWith('video/') ? STORAGE_VIDEO_FOLDER : '';
      if (!destination) {
        throw `invalid file type '${file.type}'`;
      }

      const orientation = await this.getOrientation(file);
      console.log(`putImage(orientation ${orientation})`);

      const snapshot = await this.storage.ref(`${destination}/${file.name}`).put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();
      console.log('uploaded file:', downloadURL);
      note.imageURL = downloadURL;
      note.orientation = orientation;
      return true;
    } catch (error) {
      console.error('failed to upload', error);
      return false;
    }
  }

  private getOrientation(file: any): Promise<number> {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = function (e) {
        console.log(`reader`, e);
        const view = new DataView(reader.result);
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

  search(): Observable<any[]> { // search by group name

    return this.getGroupNotes();
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

}