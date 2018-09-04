import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AngularFireModule } from 'angularfire2';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import 'firebase/storage';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { environment } from '../environments/environment';

import { AppComponent } from './app.component';
import { NotesComponent } from './notes/notes.component';
import { NoteComponent } from './notes/note/note.component';
import { ImageComponent } from './notes/note/image/image.component';
import { NoteModalComponent } from './note-modal/note-modal.component';
import { NoteService } from './note.service';
import { ModalService } from './modal.service';
import { FocusMeDirective } from './focus-me.directive';
import { AfterIfDirective } from './after-if.directive';

@NgModule({
  declarations: [
    AppComponent,
    NotesComponent,
    NoteComponent,
    NoteModalComponent,
    ImageComponent,
    FocusMeDirective,
    AfterIfDirective,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    BsDropdownModule.forRoot(),
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    ReactiveFormsModule,
  ],
  providers: [
    NoteService,
    ModalService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
