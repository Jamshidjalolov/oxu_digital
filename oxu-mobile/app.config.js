const fs = require('node:fs');
module.exports=({config})=>{
 const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
 const googleServicesFile=process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json')?'./google-services.json':undefined);
 return {...config,android:{...config.android,...(googleServicesFile?{googleServicesFile}:{})},extra:{...config.extra,...(projectId?{eas:{...config.extra?.eas,projectId}}:{})}};
};
