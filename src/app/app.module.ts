import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatInputModule, MatSnackBarModule } from '@angular/material';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { NgIdleClickModule } from 'ng-idle-click';
import { NgInputFileModule } from 'ng-input-file';
import { NgScrolltopModule } from 'ng-scrolltop';
import { NgLazyLoadModule } from 'ng-lazy-load';
import { environment } from '../environments/environment';

import { AppComponent } from './app.component';
import { NotesComponent } from './notes/notes.component';
import { NoteComponent } from './notes/note/note.component';
import { ImageComponent } from './notes/note/image/image.component';
import { NoteModalComponent } from './note-modal/note-modal.component';
import { LoaderComponent } from './loader.component';
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
    LoaderComponent,
    FocusMeDirective,
    AfterIfDirective,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    ReactiveFormsModule,
    NgIdleClickModule,
    NgInputFileModule,
    NgScrolltopModule,
    NgLazyLoadModule,
  ],
  providers: [
    NoteService,
    ModalService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
