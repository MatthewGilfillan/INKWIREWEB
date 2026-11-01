import * as Y from 'yjs';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {prosemirrorJSONToYDoc,yDocToProsemirrorJSON} from '@tiptap/y-tiptap';
import {cleanDocument} from './notebook-model.mjs';
const schema=getSchema([StarterKit.configure({link:false,heading:{levels:[2,3]}})]);
export function encodeState(bytes) {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function decodeState(text) {if(typeof text!=='string'||text.length>1200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid notebook update.');return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
export function seedState(document) {const d=prosemirrorJSONToYDoc(schema,cleanDocument(document),'document');try{return Y.encodeStateAsUpdate(d);}finally{d.destroy();}}
export function mergeState(previous,update) {
  const d=new Y.Doc();try{
    if(previous)Y.applyUpdate(d,new Uint8Array(previous));Y.applyUpdate(d,decodeState(update));
    const original=yDocToProsemirrorJSON(d,'document');schema.nodeFromJSON(original).check();const document=cleanDocument(original);
    const state=Y.encodeStateAsUpdate(d);if(state.length>800000)throw Error('This notebook page is full. Start a new page.');
    return {state,document};
  }finally{d.destroy();}
}
