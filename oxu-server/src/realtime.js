const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
let active;
const originAllowed = origin => !origin || (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(',').includes(origin);
function attach(server) {
 const wss = new WebSocketServer({ noServer:true,maxPayload:4096,perMessageDeflate:false }); active=wss;
 server.on('upgrade',(req,socket,head)=>{
  const ip=socket.remoteAddress;
  if(req.url!=='/api/realtime'||!originAllowed(req.headers.origin)||wss.clients.size>=500||[...wss.clients].filter(ws=>ws.ip===ip).length>=10){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{ws.ip=ip;wss.emit('connection',ws);});
 });
 wss.on('connection',ws=>{
  ws.on('error',()=>{}); let authenticating=false;
  const deadline=setTimeout(()=>ws.close(1008,'Authentication required'),5000);
  ws.on('message',async raw=>{
   if(ws.userId||authenticating){ws.close(1008,'Read-only connection');return;} authenticating=true;
   try {const message=JSON.parse(raw.toString());if(message.type!=='auth'||typeof message.token!=='string')throw Error();const decoded=jwt.verify(message.token,process.env.JWT_SECRET,{algorithms:['HS256']});const user=await User.findById(decoded.id).select('approved role');if(!user?.approved||!decoded.exp)throw Error();ws.userId=String(user._id);ws.expires=decoded.exp*1000;ws.role=user.role;clearTimeout(deadline);ws.send(JSON.stringify({type:'ready'}));}
   catch{ws.close(1008,'Unauthorized');}
  });
  ws.on('close',()=>clearTimeout(deadline));ws.alive=true;ws.on('pong',()=>{ws.alive=true;});
 });
 const timer=setInterval(async()=>{for(const ws of wss.clients){if(!ws.alive||ws.expires<=Date.now()){ws.terminate();continue;}ws.alive=false;ws.ping();if(ws.userId){try{const user=await User.findById(ws.userId).select('approved role');if(!user?.approved||user.role!==ws.role)ws.close(1008,'Account changed');}catch{ws.close(1011,'Unavailable');}}}},30000);timer.unref();
 server.on('close',()=>{clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();if(active===wss)active=null;});
 return wss;
}
function publish(ids){const targets=new Set(ids.filter(Boolean).map(String));for(const ws of active?.clients||[])if(ws.readyState===WebSocket.OPEN&&ws.expires>Date.now()&&targets.has(ws.userId))ws.send(JSON.stringify({type:'refresh'}));}
module.exports={attach,publish,originAllowed};
