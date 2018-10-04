import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ViewEncapsulation } from '@angular/core';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';

import { Todo } from '../Note';
import { NoteService } from '../note.service';
import { ModalService } from '../modal.service';
import { listChild } from '../app.animation';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.css'],
  animations: [
    listChild,
    trigger('item', [
      transition('* => modified', [
        animate('1000ms ease-out', keyframes([
          style({ opacity: 1, offset: 0 }),
          style({ opacity: 0, offset: 0.25 }),
          style({ opacity: 1, offset: 0.5 }),
          style({ opacity: 0, offset: 0.75 }),
          style({ opacity: 1, offset: 1 })
        ]))
      ], { delay: 600 }),
    ]),

  ],
  encapsulation: ViewEncapsulation.None
})
export class NotesComponent implements OnInit, OnDestroy {
  trackByFn = (idx, obj) => obj.$key; // do I need this?

  @ViewChild('modal')
  public modal;

  isTouchDevice: boolean;
  subscription: Subscription;

  constructor(public noteService: NoteService,
    private modalService: ModalService) {

    console.log('GroupComponent()');
  }

  ngOnInit() {
    this.modalService.setModal(this.modal);

    this.noteService.todo = Todo.List;
    this.isTouchDevice = window.matchMedia("(pointer:coarse)").matches;

    this.subscription = this.noteService.announcedLastSaved
      .subscribe(saved => {
        try {
          const savedEl = document.querySelector(`div.item[tabindex="${saved.index}"]`);
          console.log(`announcedLastSaved`, saved);
          if (savedEl && savedEl instanceof HTMLElement) {
            savedEl.focus();
          }
        } catch (e) {
          console.warn(e);
        }
      });

    console.warn(`'GroupComponent' ${this.isTouchDevice}`);
  }

  ngOnDestroy() {
    console.warn(`'GroupComponent' ngOnDestroy`);
    if (this.subscription) this.subscription.unsubscribe();
  }

  animDone(event) {
    this.noteService.resetListState();
  }

  add({ event, done }) {
    console.log(`add`);
    this.addOrEdit({ event });
    done();
  }

  addOrEdit({ event, index = -1, note = undefined }) {
    // console.log(`addOrEdit(x:${event.screenX}, i:${index}, key:${note && note.$key || 'na'})`);

    this.noteService.setTheNote(note);
    this.modal.show(event);
  }

  async remove({ note, done }) {
    this.noteService.todo = Todo.Remove;
    await this.noteService.save(note, null, false, false);
    done();
  }

}
