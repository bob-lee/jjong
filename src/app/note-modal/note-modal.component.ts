import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { NgInputFileComponent } from 'ng-input-file';

import { Todo } from '../Note';
import { NoteService } from '../note.service';

export const zoomFadeIn = { opacity: 0, transform: 'translateX({{ x }}) translateY({{ y }}) scale(0)' };
export function easeInFor(duration) { return `${duration}ms cubic-bezier(0.35, 0, 0.25, 1)`; };

const handlerScroll = e => {
  console.log(e);
  e.preventDefault();
  e.stopPropagation();
  return false;
};
const scroll = function (e) {
  console.log(e.type, e.target);
  e.preventDefault(); // how to eat up scroll event to prevent parent scrolling on modal popup???
  return false;
};

const FILE_EXISTS = 'Uploaded file exists';

@Component({
  selector: 'note-modal',
  templateUrl: './note-modal.component.html',
  styleUrls: ['./note-modal.component.css'],
  animations: [
    trigger('overlay', [
      transition(':enter', [
        style({ opacity: 0 }),
        query('.container', [style({ opacity: 0, transform: 'translateX({{ x }}) translateY({{ y }}) scale(0)', transformOrigin: '{{ ox }} {{ oy }}' })]),
        group([
          animate(easeInFor(150), style({ opacity: 1 })),
          query('.container', animate(easeInFor(450), style('*'))),
        ]),
      ], { params: { x: '0px', y: '0px', ox: '50%', oy: '50%' } }),
      transition(':leave', group([
        animate(300, style({ opacity: 0 })),
        query('.container', [
          animate(300, style(zoomFadeIn))
        ])
      ]), { params: { x: '0px', y: '0px', ox: '50%', oy: '50%' } })
    ])
  ],
  encapsulation: ViewEncapsulation.None
})
export class NoteModalComponent implements OnInit { // note form modal only for firestore
  title: string;

  @ViewChild(NgInputFileComponent)
  private fileInput: NgInputFileComponent;
  files: any;

  note: any; // reference to noteService.theNote set in init()
  noteForm: FormGroup;
  submitted: boolean = false;
  imgToRemove: boolean = false;
  _fileChanged: boolean = false; // selected or removed
  imageFailedToLoad: boolean = false; // to indicate the case where the given image url failed to load
  toTinify = true;

  data = {
    value: 'inactive',
    params: {
      x: null,
      y: null,
      ox: null,
      oy: null
    }
  };

  constructor(private formBuilder: FormBuilder,
    private noteService: NoteService) { }

  ngOnInit() {
    console.log(`'NoteModalComponent'`);

    this.noteForm = this.formBuilder.group({
      name: ['', Validators.required],
      text: ['', Validators.required]
    });
    this._fileChanged = false;
  }

  toggleTinify({ done }) {
    this.toTinify = !this.toTinify;
    console.log('toTinify', this.toTinify);
    done();
  }

  private goBack() {
    this.hide();
  }

  async save({ event, done }) {
    event.stopPropagation();
    console.log(`save ${this.noteForm.status} changed=${this.changed()}, ${this.files && this.files.length} file(s), imgToRemove=${this.imgToRemove}`);
    if (this.noteForm.invalid) {
      this.submitted = true;
      done();
      return;
    }

    if (this.changed()) {
      // take form value to model
      this.note.name = this.noteForm.value.name;
      this.note.text = this.noteForm.value.text;

      await this.saveNote(this.toTinify, this.imgToRemove);
    } else { // no change, go back without making server call
      this.noteService.todo = Todo.List;
    }

    done();
    this.goBack();
  }

  cancel({ done }) {
    this.hide();
    done();
  }

  fileChanged({ files }) {
    this._fileChanged = true;
    if (files.length === 0) {
      this.imgToRemove = true; // hide any downloaded image
    }
     this.files = files;
     console.log(`fileChanged ${files.length} file(s), imgToRemove=${this.imgToRemove}`);
  }

  get toHideImg(): boolean {
    if (this.imgToRemove || this.imageFailedToLoad) return true; // hide image
    if (!this.noteService.theNoteHasImage) return true; // hide image
    return false; // show image
  }

  private changed() { // compare form value with original note in edit case
    if (this.noteService.todo === Todo.Add) return true; // add
    const orig = this.note;
    const form = this.noteForm.value;
    const changed = form.name !== orig.name || form.text !== orig.text || this._fileChanged || this.imageFailedToLoad;
    return changed;
  }

  private async saveNote(toTinify: boolean, toRemoveExistingImage?: boolean) { // assumes this.note has form value
    try {
      const data = await this.noteService.save(this.note, this.files, this.imageFailedToLoad, toTinify, toRemoveExistingImage);
      console.log('saveNote():', data);
    } catch (error) {
      console.error('saveNote():', error);
    }
  }

  popup;
  body;
  html;

  get hasImage() { return this.note && this.note.imageURL && this.note.imageURL.indexOf('images') > -1; }
  get hasVideo() { return this.note && this.note.imageURL && this.note.imageURL.indexOf('videos') > -1; }

  loadImage() {
    if (!this.note || !this.note.imageURL) return;
    this.fileInput.filename = FILE_EXISTS;

    console.log(`imageURL ${this.note.imageURL}, ${this.hasImage}, ${this.hasVideo}`);
    if (this.hasImage) {
      const img = <HTMLImageElement>document.querySelector("#myimg");
      img.addEventListener('load', _ => console.log('image loaded'));
      img.addEventListener('error', error => {
        console.warn('image failed to load', error);
        this.imageFailedToLoad = true;
      });
      img.src = this.note.imageURL;
    } else if (this.hasVideo) {
      const video = <HTMLVideoElement>document.querySelector("#myvideo");
      video.src = this.note.imageURL;
      video.load();
    } else {
      console.warn('loadImage() gave up loading file');
    }
  }

  private init(showing: boolean = true) {
    this.body = document.querySelector('body');
    this.html = document.querySelector('html');

    if (showing) {
      this.body.classList.add('noScroll');
      this.html.classList.add('noScroll');
      if (!this.noteService.theNote) { // this component assumes the user had called noteService.setTheNote() properly
        console.warn('theNote is not set');
        return;
      }
      this.note = this.noteService.theNote;

      this.title = this.noteService.theNote.$key ? 'Edit note' : 'Add note';
      console.warn(this.title);

      // apply model to view
      this.noteForm.patchValue(this.noteService.theNote);
    } else {
      this.body.classList.remove('noScroll');
      this.html.classList.remove('noScroll');

      this.note = null;
      this.imgToRemove = false;
      this.imageFailedToLoad = false;
      this._fileChanged = false;
    }
  }

  show(event: any, group: any) {
    this.calculateZoomOrigin(event);
    this.makeVisible();
    this.init();
  }

  private calculateZoomOrigin(event) {
    const clientX = event.clientX;
    const clientY = event.clientY;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.data.params.x = `${clientX - width / 2}px`;
    this.data.params.y = `${clientY - height / 2}px`;
    this.data.params.ox = `${(clientX / width) * 100}%`;
    this.data.params.oy = `${(clientY / height) * 100}%`;

    //console.log(`zoom(${this.data.params.x}, ${this.data.params.y},${this.data.params.ox},${this.data.params.oy})`);
  }

  private makeVisible() {
    this.data.value = 'active';
  }

  hide() {
    this.init(false);

    this.data.value = 'inactive';
    console.log('hide()');
  }

  toggle() {
    this.data.value === 'active' ? this.hide() : this.makeVisible();
  }

}