import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { NoteService } from '../../note.service';
import { LazyLoadService, IntersectionState } from 'ng-lazy-load';
import { Subscription } from 'rxjs';

@Component({
  selector: 'my-note',
  templateUrl: './note.component.html',
  styleUrls: ['./note.component.css']
})
export class NoteComponent implements OnDestroy {
  @Input() note: any;
  @Input() index: number;
  @Output() toAddOrEdit: EventEmitter<any> = new EventEmitter();
  @Output() toRemove: EventEmitter<any> = new EventEmitter();

  toLoad = false; // local state for lazy-loading offscreen images
  private _subcription: Subscription;
  
  get imageURL() { 
    return this.toLoad && this.note.imageURL && this.note.imageURL.indexOf('images') > -1 ? this.note.imageURL : ''; 
  }
  get videoURL() { 
    return this.toLoad && this.note.imageURL && this.note.imageURL.indexOf('videos') > -1 ? this.note.imageURL : ''; 
  }

  constructor(public noteService: NoteService,
    private lazyLoadService: LazyLoadService) {
    this._subcription = this.lazyLoadService.announcedIntersection
      .subscribe(params => {
        const { index, state } = params;
        if (!this.toLoad && (this.index - index) <= 2) {
          this.toLoad = true;
          console.log(`(${index},${IntersectionState[state]}) loading [${this.index}]`);
        }
      });
  }

  ngOnDestroy() {
    if (this._subcription) {
      this._subcription.unsubscribe();
    }
  }

  edit({ event, done }) {
    console.log(`edit`);
    this.doEdit(event, -1, this.note);
    done();
  }

  remove({ event, done }) {
    console.log(`remove`);

    const ref = this.noteService.openSnackBar('Do you want to remove this note permanently?', 'Remove');
    const dismiss = ref.afterDismissed().subscribe(_ => {
      done();
      console.log('Snackbar dismissed');
    });
    ref.onAction().subscribe(_ => {
      dismiss.unsubscribe();
      console.log('User confirmed to remove');
      this.doRemove(this.note, done);
    })
  }

  private doEdit(event, index: number, note: any) {
    this.toAddOrEdit.emit({ event, index, note });
  }

  private doRemove(note, done) {
    this.toRemove.emit({ note, done });
  }

}
