import {useEffect,useState} from 'react'
export default function useRealtimeRevision(){const [revision,setRevision]=useState(0);useEffect(()=>{let timer;const update=()=>{clearTimeout(timer);timer=setTimeout(()=>setRevision(n=>n+1),150);};window.addEventListener('oxu-refresh',update);return()=>{clearTimeout(timer);window.removeEventListener('oxu-refresh',update);};},[]);return revision;}
