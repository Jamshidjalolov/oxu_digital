import { Outlet } from 'react-router-dom'
import MemberShell from '../../components/MemberShell.jsx'
const links=[{to:'/department-head',label:'Kafedra KPI',end:true},{to:'/department-head/schedule',label:'Mening dars jadvalim'},{to:'/department-head/workload',label:'Mening yuklamam'},{to:'/department-head/profile',label:'Mening profilim'}]
export default function DepartmentLayout(){return <MemberShell links={links} roleLabel="Kafedra mudiri"/>}
