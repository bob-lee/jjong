// import { animate, animateChild, animation, group, query, stagger, style, transition, trigger, useAnimation } from '@angular/animations';
import { animate, animateChild, animation, group, keyframes, 
  query, style, transition, trigger } from '@angular/animations';

export const PERIOD_1 = '500ms ease';
export const PERIOD_2 = '500ms ease';
/*
export const listChild = trigger('listChild', [
  transition('* => *', [
    query(':enter', [
      style({ height: 0, opacity: 0 })
    ], { optional: true }),
    query(':leave', [ // item removed
      style({ opacity: 1, height: '5em' }),
      animate('1s ease-out', style({ opacity: 0, height: 0 }))
    ], { optional: true }),
    query(':enter', [
      animate('1s', style({ height: '*', opacity: 1 }))
    ], { optional: true })

  ])
]);
*/
export const listChild = trigger('listChild', [
  transition('* => *', [
    query(':enter', [
      style({ height: 0, opacity: 0 })
    ], { optional: true }),
    query(':leave', [ // item removed
      style({ opacity: 1, height: '5em' }),
      animate('1s ease-out', style({ opacity: 0, height: 0 }))
    ], { optional: true }),
    query(':enter', [ // item added
      animate('1s', style({ height: '*', opacity: 1 }))
    ], { optional: true }),
    query('my-note.modified', [ // item modified
      animate('1000ms ease-out', keyframes([
        style({ opacity: 1, offset: 0 }),
        style({ opacity: 0, offset: 0.25 }),
        style({ opacity: 1, offset: 0.5 }),
        style({ opacity: 0, offset: 0.75 }),
        style({ opacity: 1, offset: 1 })
      ]))
    ], { optional: true }),
  
  ])
]);
