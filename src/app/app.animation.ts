import { animate, animateChild, animation, group, query, stagger, style, transition, trigger, useAnimation } from '@angular/animations';

export const PERIOD_1 = '500ms ease';
export const PERIOD_2 = '500ms ease';

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
