import React,{useEffect} from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL } from './config';
import { getItem } from './storage';
import { useAuth } from './context/AuthContext';
const listeners=new Set();
export const subscribeRealtime=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export default function Realtime(){const {user}=useAuth();useEffect(()=>{if(!user)return;let stopped=false,ws,timer;const connect=async()=>{const token=await getItem('oxu_token');if(stopped||!token)return;ws=new WebSocket(API_BASE_URL.replace(/^http/,'ws').replace(/\/$/,'')+'/realtime');ws.onopen=()=>ws.send(JSON.stringify({type:'auth',token}));ws.onmessage=e=>{try{if(['ready','refresh'].includes(JSON.parse(e.data).type))for(const fn of listeners)fn();}catch{}};ws.onerror=()=>ws.close();ws.onclose=e=>{if(!stopped&&e.code!==1008)timer=setTimeout(connect,4000);};};connect();const state=AppState.addEventListener('change',s=>{if(s==='active'&&ws?.readyState===3){clearTimeout(timer);connect();}});return()=>{stopped=true;clearTimeout(timer);ws?.close();state.remove();};},[user?.id]);return null;}
