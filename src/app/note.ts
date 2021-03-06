export interface Note {
  name: string;
  text: string;
  updatedAt: any; // for sorting
  imageURL: string;
  orientation: number; // EXIF orientation
}

export enum Todo {
  List = 0, 
  Add,
  Edit,
  Remove
}

export enum LoginWith {
  Facebook = 0, 
  Google,
  Anonymous
}