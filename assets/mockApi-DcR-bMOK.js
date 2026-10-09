import{a as o,c as x,d as M,g as B,e as z,s as U,h as H,i as V}from"./index-OX-CmLp7.js";import{A as pe}from"./index-OX-CmLp7.js";import"./vendor-icons-BrORt0m_.js";import"./vendor-react-kBaY4_pK.js";import"./vendor-globe-BTOyu2GH.js";function D(e){if(!e||["expectedCount","markedCount","presentCount","lateCount","absentCount","unmarkedCount"].some(a=>!Number.isInteger(e[a])||e[a]<0)||!(e.attendancePercentage===null||Number.isFinite(e.attendancePercentage)&&e.attendancePercentage>=0&&e.attendancePercentage<=100))throw new Error("Invalid examination attendance metrics");if(e.markedCount!==e.presentCount+e.lateCount+e.absentCount||e.expectedCount!==e.markedCount+e.unmarkedCount||e.expectedCount===0&&e.attendancePercentage!==null)throw new Error("Inconsistent examination attendance metrics")}function k(e){if(!e||!Number.isInteger(e.page)||e.page<1||!Number.isInteger(e.limit)||e.limit<1||!Number.isInteger(e.total)||e.total<0||!Number.isInteger(e.totalPages)||e.totalPages<0)throw new Error("Invalid attendance pagination")}function $(e){if(!Array.isArray(e)||e.some(t=>typeof t?.studentId!="string"||!["NOT_MARKED","PRESENT","LATE","ABSENT"].includes(t.status)))throw new Error("Invalid frozen attendance roster")}function L(e){if(typeof e?.id!="string"||!e.id.trim()||typeof e.examHallId!="string"||!e.examHallId.trim())throw new Error("Invalid attendance session identity")}let P=z()||null;const F=new Map,ee=[{id:"tc-1",name:"AZM Central Examination Center - Mansehra",code:"TC-MHR-01",campus:"Main College Road Campus",address:"Near College Chowk, Karakoram Highway, Mansehra",district:"Mansehra",province:"Khyber Pakhtunkhwa",capacity:450,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Prof. Dr. Sumama Khan",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-10T00:00:00Z"},{id:"tc-2",name:"Govt Post Graduate College No. 1 - Abbottabad",code:"TC-ATD-02",campus:"Main College Campus",address:"College Road, Near Mandian, Abbottabad",district:"Abbottabad",province:"Khyber Pakhtunkhwa",capacity:350,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Admissions & Testing Coordinator",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-12T00:00:00Z"},{id:"tc-3",name:"Hazara Public School & College Center - Haripur",code:"TC-HRP-03",campus:"Central Hall",address:"Main G.T Road, Haripur, Khyber Pakhtunkhwa",district:"Haripur",province:"Khyber Pakhtunkhwa",capacity:300,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Controller of Examination",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-15T00:00:00Z"},{id:"tc-4",name:"Khyber Public School & College Regional Hub - Battagram",code:"TC-BTG-04",campus:"City Campus",address:"Karakoram Highway, Battagram",district:"Battagram",province:"Khyber Pakhtunkhwa",capacity:220,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Regional Coordinator",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-20T00:00:00Z"}];function te(e){if(e.cnicOrBForm){const t=e.cnicOrBForm.replace(/\D/g,"");if(t.length>=5)return`CNIC_${t}`}return e.applicationNo&&e.applicationNo.trim()?e.applicationNo.trim().toUpperCase():e.rollNumber&&e.rollNumber.trim()?e.rollNumber.trim().toUpperCase():e.fullName&&e.fatherName?`NAME_${e.fullName.trim().toLowerCase()}_${e.fatherName.trim().toLowerCase()}`:e.id?e.id.trim().toLowerCase():`STD_${Math.random()}`}function ae(e,t){}function O(e){if(typeof e!="string")return null;const t=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(e);if(!t)return null;const[,a,i,n,l,d,u="0",s="0",c]=t,f=[+a,+i,+n,+l,+d,+u,+s.padEnd(3,"0")],r=new Date(0);if(r.setUTCFullYear(f[0],f[1]-1,f[2]),r.setUTCHours(f[3],f[4],f[5],f[6]),r.getUTCFullYear()!==f[0]||r.getUTCMonth()!==f[1]-1||r.getUTCDate()!==f[2]||r.getUTCHours()!==f[3]||r.getUTCMinutes()!==f[4]||r.getUTCSeconds()!==f[5])return null;let g=300;if(c==="Z")g=0;else if(c){const p=+c.slice(1,3),E=+c.slice(4,6);if(p>23||E>59)return null;g=(p*60+E)*(c[0]==="+"?1:-1)}return new Date(r.getTime()-g*6e4)}function j(e){return O(e)?.toISOString()??null}function G(e,t=Date.now()){const a=O(e.releaseDateTime);return!e.isScheduled||a!==null&&t>=a.getTime()}function ie(e){const t=O(e);if(!t)return"Official release time requires correction";const a=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Karachi",weekday:"long",year:"numeric",month:"long",day:"numeric"}).format(t),i=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Karachi",hour:"2-digit",minute:"2-digit",hour12:!0}).format(t);return`${a} at ${i} PKT`}function ne(e){const t=O(e);return t?new Date(t.getTime()+300*6e4).toISOString().slice(0,16):""}const _={isScheduled:!1,releaseDateTime:"2026-10-15T09:00:00",announcementTitle:"Roll Number Slips Official Release Schedule",announcementMessage:"Official Roll Number Slips, Assigned Test Centers, and Examination Hall seatings are live.",emergencyNotice:"Your registration and fee verification are permanently confirmed in the examination registry.",examCenterName:"Dubai International School and College Boys Campus Mansehra",examDate:"2026-11-15",femaleReportingTime:"08:00",femaleTestStartTime:"09:00",femaleTestEndTime:"10:00",maleReportingTime:"11:00",maleTestStartTime:"12:00",maleTestEndTime:"13:00",updatedAt:"2026-08-24T00:00:00Z"};let N={..._};async function J(){try{const e=await o("/api/students/release-config"),t=e?.data||e;if(t&&typeof t.isScheduled=="boolean")return N={..._,...t},N}catch(e){console.warn("Failed to fetch roll number release config from live server:",e)}return N}function re(){return N}async function K(e){const t=j(e.releaseDateTime??N.releaseDateTime);if(!t)throw new Error("Invalid release date/time. Enter a valid Pakistan release time.");const a={...N,...e,releaseDateTime:t,updatedAt:new Date().toISOString()};N=a;try{const i=await o("/api/students/release-config",{method:"POST",body:JSON.stringify(a)}),n=i?.data||i||a;return N=n,n}catch(i){return console.warn("Failed to persist release config to backend:",i),a}}function X(){return G(N)}const oe={async login(e,t){const a=await o("/api/auth/login",{method:"POST",body:JSON.stringify({email:e,password:t})}),i={id:a.user.id,name:a.user.name||a.user.email.split("@")[0],email:a.user.email,role:a.user.role,avatarUrl:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"};return H(a.accessToken),a.refreshToken&&V(a.refreshToken),U(i),P=i,{user:i,token:a.accessToken,role:i.role}},async getCurrentUser(){if(P||(P=z()),!B())return P;try{const t=await o("/api/auth/me");t&&t.user&&(P={...t.user,avatarUrl:t.user.avatarUrl||"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"},U(P))}catch{}return P},async getDashboardOverview(){const e=await o("/api/dashboard/overview"),t=await o("/api/fees?status=UNPAID").catch(()=>[]),a=Array.isArray(t)?t:Array.isArray(t?.feeRecords)?t.feeRecords:[],i=e?.period?.date?new Date(e.period.date):new Date,n=i.getDay(),l=n===0?-6:1-n,d=new Date(i);d.setDate(i.getDate()+l);const u=["Mon","Tue","Wed","Thu","Fri"],s=e?.attendanceToday,c=s?{sessionCount:s.sessionCount,expectedCount:s.expectedCount,markedCount:s.markedCount,presentCount:s.presentCount,lateCount:s.lateCount,absentCount:s.absentCount,unmarkedCount:s.unmarkedCount,attendancePercentage:s.attendancePercentage??null}:null,f=c?.attendancePercentage??null,r=(c?.sessionCount||0)>0,g=u.map((p,E)=>{const m=new Date(d);m.setDate(d.getDate()+E);const w=m.toDateString()===i.toDateString();return{day:`${p} ${m.getDate()}`,isToday:w,hasSession:w?r:!1,rate:w&&r?f:null}});return{stats:{totalStudents:e.stats?.totalStudents||0,totalPartners:e.stats?.totalPartners??e.partnerStats?.totalPartners??0,pendingPartners:e.stats?.pendingPartners??e.partnerStats?.pendingPartners??0,totalExpectedApplicants:e.stats?.totalExpectedApplicants||0,attendancePercentage:e.attendanceToday?.attendancePercentage??null,feeCollectionPercentage:e.feeCollection?.collectionPercentage||0,activeStaffCount:e.stats?.activeStaffCount||0,totalBilled:e.feeCollection?.totalBilled||0,totalCollected:e.feeCollection?.totalCollected||0,feeIncome:e.financialFlow?.feeIncome||0,salaryExpenses:e.financialFlow?.salaryExpenses||0,netCashFlow:e.financialFlow?.netCashFlow||0},attendanceToday:c,attendanceTrends:g,feeDefaulters:(a||[]).slice(0,5).map(p=>({id:p.id,studentName:p.student?.fullName||p.studentName||"Candidate",rollNumber:p.student?.rollNumber||p.rollNumber||"Pending Approval",currentClass:p.student?.currentClass||p.currentClass||"SSC",amountDue:Number(p.amountDue)||300,status:p.status||"UNPAID"})),recentActivity:[],demographics:{byGender:e.studentDemographics?.byGender||{MALE:0,FEMALE:0},byClassLevel:e.studentDemographics?.byClassLevel||{},byScholarshipCategory:e.studentDemographics?.byScholarshipCategory||{}}}},async getStudentsPage(e){const t=new URLSearchParams;t.append("page",String(e?.page||1)),t.append("limit",String(e?.limit||50)),e?.classLevel&&e?.classLevel!=="ALL"&&t.append("classLevel",e.classLevel),e?.gender&&e?.gender!=="ALL"&&t.append("gender",e.gender),e?.status&&e?.status!=="ALL"&&t.append("status",e.status),e?.search&&e.search.trim()&&t.append("search",e.search.trim());const a=`?${t.toString()}`,i=await o(`/api/students${a}`),l=(Array.isArray(i)?i:Array.isArray(i?.students)?i.students:[]).map(d=>({...d,rollNumber:d.rollNumber||null,feeStatus:d.feeStatus||(d.feeRecords?.length?d.feeRecords[0].status:"UNPAID"),attendancePercentage:d.attendancePercentage}));return{students:l,pagination:i?.pagination||{page:e?.page||1,limit:e?.limit||50,total:l.length,totalPages:1}}},async getStudents(e){return(await this.getStudentsPage({...e,page:1,limit:250})).students},async getStudentById(e){const t=await o(`/api/students/${e}`);return{...t,feeStatus:t.feeStatus||(t.feeRecords?.length?t.feeRecords[0].status:"UNPAID"),attendancePercentage:t.attendancePercentage}},async createStudent(e){return await o("/api/students/register",{method:"POST",body:JSON.stringify(e)})},async uploadStudentDocument(e){const t=(e.cnicOrBForm||e.applicationNo||e.studentId)?.trim();let a;if(!B()){if(!t||t==="TEMP_CANDIDATE")throw new Error("Enter the candidate CNIC or B-Form before uploading documents.");a=F.get(t),a||(a=(await o("/api/students/upload-session",{method:"POST",body:JSON.stringify({cnicOrBForm:t})})).token,F.set(t,a))}let i;const n=e.fileData.match(/^data:([^;]+);base64,(.*)$/s);if(n&&t){const l=atob(n[2]),d=new Uint8Array(l.length);for(let u=0;u<l.length;u++)d[u]=l.charCodeAt(u);i=await o("/api/students/upload-document-binary",{method:"POST",headers:{"Content-Type":e.contentType||n[1],"X-Candidate-Key":t,"X-Document-Type":e.docType,"X-File-Name":encodeURIComponent(e.fileName||`${e.docType}.bin`),...a?{"X-Upload-Session":a}:{}},body:new Blob([d],{type:e.contentType||n[1]})})}else i=await o("/api/students/upload-document",{method:"POST",headers:a?{"X-Upload-Session":a}:void 0,body:JSON.stringify(e)});return i?.data||i},async approveStudentPayment(e){return await o(`/api/students/${e}/approve-payment`,{method:"POST"})||{success:!0}},async getRollNumberStatus(){const e=await o("/api/students/roll-number-status");return e?.data||e},async issueRollNumbers(e){const t=await o("/api/students/issue-roll-numbers",{method:"POST",body:JSON.stringify({scheduledDate:e})});return t?.data||t},async deleteStudent(e){return await o(`/api/students/${e}`,{method:"DELETE"}),!0},async getRollNumberReleaseConfig(){return J()},async updateRollNumberReleaseConfig(e){return K(e)},isRollNumberReleased(){return X()},releaseAllPaidRollNumbers(){return 0},async updateStudent(e,t){const a=await o(`/api/students/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async updateOfficeUse(e,t){return o(`/api/students/${e}/office-use`,{method:"PATCH",body:JSON.stringify(t)})},async getExamHalls(){const e=await o("/api/exam-halls");if(!Array.isArray(e)||e.some(t=>typeof t?.id!="string"||!Number.isInteger(t?.assignedCount)))throw new Error("Invalid exam halls response.");return e},async getExamHall(e){const t=await o(`/api/exam-halls/${e}`);if(t?.id!==e||!Array.isArray(t?.assignedStudents))throw new Error("Invalid hall roster response.");return t},async getHallCandidates(e){const t=new URLSearchParams;for(const[i,n]of Object.entries(e))n!==void 0&&n!==""&&t.set(i,String(n));const a=await o(`/api/exam-halls/candidates?${t}`);if(!Array.isArray(a?.candidates)||!a?.pagination||!["page","limit","total","totalPages"].every(i=>Number.isInteger(a.pagination[i]))||a.pagination.page<1||a.pagination.limit<1||a.pagination.total<0||a.pagination.totalPages<0)throw new Error("Invalid candidate placement response.");return a},async createExamHall(e){const t=await o("/api/exam-halls",{method:"POST",body:JSON.stringify(e)});if(typeof t?.id!="string"||typeof t?.name!="string")throw new Error("Invalid created hall response.");return t},async updateExamHall(e,t){const a=await o(`/api/exam-halls/${e}`,{method:"PATCH",body:JSON.stringify(t)});if(a?.id!==e||typeof a?.name!="string")throw new Error("Invalid updated hall response.");return a},async deleteExamHall(e){if((await o(`/api/exam-halls/${e}`,{method:"DELETE"}))?.success!==!0)throw new Error("Invalid hall deletion response.");return!0},async updateStudentAllocation(e,t){const a=await o(`/api/exam-halls/students/${e}/allocation`,{method:"PATCH",body:JSON.stringify(t)});if(a?.id!==e)throw new Error("Invalid allocation response.");return a},async batchAssignStudentsToHall(e,t,a){const i=await o(`/api/exam-halls/${e}/batch-assign`,{method:"POST",body:JSON.stringify({studentIds:a,hallName:t.hallName,roomNumber:t.roomNumber,testCenterName:t.testCenterName})});if(!Number.isInteger(i?.assignedCount)||i.assignedCount<0)throw new Error("Invalid batch allocation response.");return i.assignedCount},async unassignStudentFromHall(e){const t=await o(`/api/exam-halls/students/${e}/allocation`,{method:"DELETE"});if(t?.id!==e||t.assignedHallId!==null||t.seatNo!==null)throw new Error("Invalid unassignment response.");return!0},async downloadStudentPdf(e,t,a){if(!e)throw new Error("Student identifier is required to download the registration slip.");const i={};a?.cnicOrBForm&&(i["X-Candidate-CNIC"]=String(a.cnicOrBForm).trim()),await x(`/api/students/${encodeURIComponent(e)}/registration-pdf`,`AZM-Registration-${t||e}.pdf`,{headers:i})},async printStudentRegistrationPdf(e,t){if(!e)throw new Error("Student identifier is required to print the registration slip.");const a={};t?.cnicOrBForm&&(a["X-Candidate-CNIC"]=String(t.cnicOrBForm).trim()),await M(`/api/students/${encodeURIComponent(e)}/registration-pdf`,{headers:a})},async startProfileThumbnailBackfill(){await o("/api/students/backfill-profile-thumbnails",{method:"POST"})},async downloadRollSlipPdf(e,t,a){try{await this.downloadStudentRollSlipPdf(e,t);return}catch(n){if(n instanceof Error&&n.message.includes("PLACEMENT_PENDING"))throw n;console.warn("Server-side roll slip PDF fallback to client print:",n)}let i;try{i=await this.getStudentById(e)}catch{i={...a,id:e,rollNumber:t||a?.rollNumber,placementStatus:"PLACEMENT_PENDING",assignedHallId:null}}Z(i||{id:e,rollNumber:t})},async downloadStudentRollSlipPdf(e,t){if(!e)throw new Error("Student identifier is required to download roll number slip.");await x(`/api/students/${encodeURIComponent(e)}/roll-slip-pdf`,`AZM-RollSlip-${t||e}.pdf`)},async downloadStudentOmrPdf(e,t){if(!e)throw new Error("Student identifier is required to download OMR answer sheet.");await x(`/api/students/${encodeURIComponent(e)}/omr-sheet-pdf`,`AZM-OMR-${t||e}.pdf`)},async downloadBulkOmrPdf(e){if(!e?.length)throw new Error("At least one student must be selected.");await x("/api/students/bulk-omr-pdf",`AZM-Bulk-OMR-${e.length}-Candidates.pdf`,{method:"POST",body:{studentIds:e}})},async downloadBulkRollSlipsPdf(e){if(!e?.length)throw new Error("At least one student must be selected.");await x("/api/students/bulk-roll-slips-pdf",`AZM-Bulk-RollSlips-${e.length}-Candidates.pdf`,{method:"POST",body:{studentIds:e}})},async printStudentRollSlipPdf(e){if(!e)throw new Error("Student identifier is required to print roll number slip.");await M(`/api/students/${encodeURIComponent(e)}/roll-slip-pdf`,{title:"Printing Roll Number Slip…"})},async printStudentOmrPdf(e){if(!e)throw new Error("Student identifier is required to print OMR answer sheet.");await M(`/api/students/${encodeURIComponent(e)}/omr-sheet-pdf`,{title:"Printing MCQs OMR Sheet…"})},async downloadRegistrationSlipPdf(e){const t=e?.id||e?.applicationNo,a=e?.rollNumber;return this.downloadStudentPdf(t,a,e)},async downloadStudentsListPdf(e,t){const a=new URLSearchParams;e?.classLevel&&e.classLevel!=="ALL"&&a.append("classLevel",e.classLevel),e?.gender&&e.gender!=="ALL"&&a.append("gender",e.gender),e?.status&&e.status!=="ALL"&&a.append("status",e.status),e?.search&&e.search.trim()&&a.append("search",e.search.trim());const i=`AZM-Students-${new Date().toISOString().split("T")[0]}.pdf`;await x(`/api/students/export-pdf?${a.toString()}`,i)},async downloadAllStudentsListPdf(){const e=`AZM-Students-All-${new Date().toISOString().split("T")[0]}.pdf`;await x("/api/students/export-all-pdf",e)},async downloadSelectedStudentsListPdf(e){if(!Array.isArray(e)||e.length<1||e.length>250||new Set(e).size!==e.length)throw new Error("Select between 1 and 250 unique students to export.");const t=`AZM-Students-Selected-${e.length}-${new Date().toISOString().split("T")[0]}.pdf`;await x("/api/students/export-selected-pdf",t,{method:"POST",body:{studentIds:e}})},async getPartners(e){const t=new URLSearchParams;e?.search&&t.set("search",e.search),e?.status&&e.status!=="ALL"&&t.set("status",e.status),e?.institutionType&&e.institutionType!=="ALL"&&t.set("institutionType",e.institutionType),e?.district&&e.district!=="ALL"&&e.district!=="all"&&t.set("district",e.district),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit)),e?.sortBy&&t.set("sortBy",e.sortBy),e?.sortOrder&&t.set("sortOrder",e.sortOrder);const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/partners${a}`);return i&&i.data&&Array.isArray(i.data)?{data:i.data,pagination:i.pagination||{page:1,limit:i.data.length,total:i.data.length,totalPages:1}}:Array.isArray(i)?{data:i,pagination:{page:1,limit:i.length,total:i.length,totalPages:1}}:{data:[],pagination:{page:1,limit:25,total:0,totalPages:1}}},async getPartnerById(e){const t=await o("/api/partners/"+e);return t?.data!==void 0?t.data:t},async getPartnerStatusHistory(e){const t=await o("/api/partners/"+e+"/status-history");return t&&Array.isArray(t.data)?t.data:Array.isArray(t)?t:[]},async registerPartner(e,t){const a={};return t&&(a["Idempotency-Key"]=t),o("/api/partners/register",{method:"POST",headers:a,body:JSON.stringify(e)})},async createPartner(e){const t=await o("/api/partners",{method:"POST",body:JSON.stringify(e)});return t?.data!==void 0?t.data:t},async updatePartnerProfile(e,t){const a=await o(`/api/partners/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data!==void 0?a.data:a},async updatePartnerStatus(e,t){return o(`/api/partners/${e}/status`,{method:"PATCH",body:JSON.stringify(t)})},async downloadPartnerPdf(e,t,a){const i={};a?.mobile&&(i["X-Partner-Mobile"]=a.mobile.trim()),a?.email&&(i["X-Partner-Email"]=a.email.trim()),await x(`/api/partners/${e}/registration-pdf`,`AZM_Partner_Acknowledgement_${t||e}.pdf`,{headers:i})},async getAttendanceSessions(e){const t=new URLSearchParams;t.set("page",String(e?.page||1)),t.set("limit",String(e?.limit||25)),e?.examHallId&&t.set("examHallId",e.examHallId),e?.businessDate&&t.set("businessDate",e.businessDate),e?.status&&t.set("status",e.status);const a=await o(`/api/attendance/sessions?${t.toString()}`);if(!Array.isArray(a?.sessions)||!a?.pagination)throw new Error("Invalid attendance sessions response");return k(a.pagination),a.sessions.forEach(i=>{if(typeof i?.id!="string"||typeof i.examHallId!="string")throw new Error("Invalid attendance session");D(i.stats)}),a},async getAttendanceSession(e){const t=await o(`/api/attendance/sessions/${encodeURIComponent(e)}`);if(!t?.session||!t?.stats||!Array.isArray(t?.roster))throw new Error("Invalid attendance session detail");return L(t.session),D(t.stats),$(t.roster),t},async createAttendanceSession(e){const t=await o("/api/attendance/sessions",{method:"POST",body:JSON.stringify(e)});if(!t?.session||!t?.stats||!Array.isArray(t?.roster))throw new Error("Invalid created attendance session");return L(t.session),D(t.stats),$(t.roster),t},async getAttendanceSessionCandidates(e,t){const a=new URLSearchParams({page:String(t?.page??1),limit:String(t?.limit??25)});t?.search?.trim()&&a.set("search",t.search.trim());const i=await o(`/api/attendance/sessions/${encodeURIComponent(e)}/candidates?${a}`);return $(i?.candidates),k(i?.pagination),i},async markAttendanceSession(e,t){if([t.studentId,t.rollNumber,t.qrToken].filter(l=>typeof l=="string"&&l.trim()).length!==1)throw new Error("Provide exactly one studentId, rollNumber, or qrToken");const i=Object.fromEntries(Object.entries(t).filter(([,l])=>l!==void 0).map(([l,d])=>[l,typeof d=="string"?d.trim():d])),n=await o(`/api/attendance/sessions/${encodeURIComponent(e)}/mark`,{method:"POST",body:JSON.stringify(i)});if(!n?.attendance||!n?.student)throw new Error("Invalid attendance mark response");return n},async closeAttendanceSession(e,t={}){const a=await o(`/api/attendance/sessions/${encodeURIComponent(e)}/close`,{method:"POST",body:JSON.stringify({markRemainingAbsent:t.markRemainingAbsent??!1})});if(!a?.session||!a?.stats||!Array.isArray(a?.roster))throw new Error("Invalid closed attendance session");return L(a.session),D(a.stats),$(a.roster),a},async scanAttendance(e){if(typeof e.sessionId!="string"||!e.sessionId.trim())throw new Error("Attendance session is required");const{sessionId:t,...a}=e;if(!a.qrToken)return this.markAttendanceSession(t,{...a,status:a.status||"PRESENT"});const i=()=>Object.assign(new Error("Invalid Candidate QR"),{code:"INVALID_QR"});if(a.studentId||a.rollNumber||a.status&&a.status!=="PRESENT")throw i();let n=a.qrToken.trim();if(n.length>4096)throw i();if(!n.startsWith("qr_")){let c;try{c=new URL(n,"https://azmaio.com")}catch{throw i()}if(c.protocol!=="https:"||!["azmaio.com","www.azmaio.com"].includes(c.hostname)||c.port||c.username||c.password||c.pathname!=="/attend"||c.hash||c.searchParams.getAll("token").length!==1)throw i();n=c.searchParams.get("token")??""}if(!/^qr_[^\s.]{1,1024}\.[a-fA-F0-9]{64}$/.test(n))throw i();const l=await o("/api/attendance/scan",{method:"POST",timeoutMs:15e3,body:JSON.stringify({sessionId:t.trim(),qrToken:n,status:"PRESENT"})}),d=l?.attendance,u=l?.student,s=c=>typeof c=="string"&&!!c.trim();if(!d||!u||!s(d.id)||d.sessionId!==t.trim()||!s(d.studentId)||u.id!==d.studentId||!s(u.fullName)||u.status!=="ACTIVE"||!s(d.markedByUserId)||!s(d.createdAt)||!Number.isFinite(Date.parse(d.createdAt))||!["PRESENT","LATE","ABSENT"].includes(d.status)||!["MANUAL","QR_SCAN"].includes(d.method)||l.alreadyMarked!==void 0&&typeof l.alreadyMarked!="boolean"||!l.alreadyMarked&&(d.status!=="PRESENT"||d.method!=="QR_SCAN"))throw new Error("The server did not confirm a persisted attendance record for this session.");return l},async getTodayAttendance(){const e=await o("/api/attendance/today");if(!Number.isInteger(e?.sessionCount)||!Number.isInteger(e?.expectedCount)||!(e?.attendancePercentage===null||Number.isFinite(e?.attendancePercentage)))throw new Error("Invalid examination attendance summary");return e},async getStudentAttendanceHistory(e){const t=await o(`/api/attendance/student/${e}`);if(Array.isArray(t?.history)&&Array.isArray(t?.legacyHistory))return D(t.stats),k(t.pagination),t;throw new Error("Invalid student attendance history response")},async getFees(e){try{const t=new URLSearchParams;e?.month&&e.month!=="ALL"&&t.append("month",e.month),e?.status&&e.status!=="ALL"&&t.append("status",e.status);const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/fees${a}`);return(Array.isArray(i)?i:Array.isArray(i?.feeRecords)?i.feeRecords:[]).map(l=>({id:l.id,challanNumber:l.challanNumber,studentId:l.studentId,studentName:l.student?.fullName||l.studentName||"Candidate",rollNumber:l.student?.rollNumber||l.rollNumber||"Pending Fee Approval",currentClass:l.student?.currentClass||l.currentClass||"SSC",month:l.month,amountDue:Number(l.amountDue)||300,amountPaid:Number(l.amountPaid)||0,status:l.status||"UNPAID",dueDate:l.dueDate?new Date(l.dueDate).toISOString().split("T")[0]:"2026-08-28",createdAt:l.createdAt}))}catch(t){return console.warn("Fees fetch error:",t),[]}},async generateChallans(e){return o("/api/fees/generate-challan",{method:"POST",body:JSON.stringify(e)})},async markFeePaid(e,t){return o(`/api/fees/${e}/mark-paid`,{method:"POST",body:JSON.stringify(t)})},async getStaffDirectory(e){const t=new URLSearchParams;e?.search?.trim()&&t.set("search",e.search.trim()),e?.role?.trim()&&t.set("role",e.role.trim()),e?.status&&t.set("status",e.status),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit));const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/staff${a}`),n=Array.isArray(i?.staff)?i.staff:Array.isArray(i?.data?.staff)?i.data.staff:Array.isArray(i?.data)?i.data:Array.isArray(i)?i:[],l=i?.pagination||i?.data?.pagination,d=n.map(s=>({id:s.id,fullName:s.fullName||"",role:s.role||"",cnic:s.cnic||"",phone:s.phone||"",status:s.status==="INACTIVE"?"INACTIVE":"ACTIVE",joinDate:s.joinDate?typeof s.joinDate=="string"?s.joinDate.split("T")[0]:String(s.joinDate):"",createdAt:s.createdAt||"",updatedAt:s.updatedAt||""})),u={page:Number(l?.page)||1,limit:Number(l?.limit)||e?.limit||20,total:Number(l?.total)||d.length,totalPages:Number(l?.totalPages)||(l?.total?Math.ceil(l.total/(Number(l?.limit)||20)):1)};return{staff:d,pagination:u}},async getStaffById(e){const t=await o(`/api/staff/${e}`),a=t?.data||t;return{portalAccount:a.portalAccount??null,salaryPayments:Array.isArray(a.salaryPayments)?a.salaryPayments:[],id:a.id,fullName:a.fullName||"",role:a.role||"",cnic:a.cnic||"",phone:a.phone||"",joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"",salary:a.salary!=null?String(a.salary):"0",status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||"",payroll:Array.isArray(a.payroll)?a.payroll.map(i=>({id:i.id,staffId:i.staffId,month:i.month||"",amount:i.amount!=null?String(i.amount):"0",status:i.status==="PAID"?"PAID":"PENDING",paidAt:i.paidAt||null,createdAt:i.createdAt||"",updatedAt:i.updatedAt||""})):[]}},async createStaffMember(e){const t=await o("/api/staff",{method:"POST",body:JSON.stringify(e)}),a=t?.data||t;return{portalAccount:a.portalAccount??null,salaryPayments:Array.isArray(a.salaryPayments)?a.salaryPayments:[],id:a.id,fullName:a.fullName||"",role:a.role||"",cnic:a.cnic||"",phone:a.phone||"",joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"",salary:a.salary!=null?String(a.salary):"0",status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||"",payroll:[],...a.portalCredentials?{portalCredentials:a.portalCredentials}:{}}},async updateStaffMember(e,t){const a=await o(`/api/staff/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{portalAccount:i.portalAccount??null,salaryPayments:Array.isArray(i.salaryPayments)?i.salaryPayments:[],id:i.id,fullName:i.fullName||"",role:i.role||"",cnic:i.cnic||"",phone:i.phone||"",joinDate:i.joinDate?typeof i.joinDate=="string"?i.joinDate.split("T")[0]:String(i.joinDate):"",salary:i.salary!=null?String(i.salary):"0",status:i.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:i.createdAt||"",updatedAt:i.updatedAt||"",payroll:Array.isArray(i.payroll)?i.payroll.map(n=>({id:n.id,staffId:n.staffId,month:n.month||"",amount:n.amount!=null?String(n.amount):"0",status:n.status==="PAID"?"PAID":"PENDING",paidAt:n.paidAt||null,createdAt:n.createdAt||"",updatedAt:n.updatedAt||""})):[]}},async payStaffSalaryOnce(e,t,a){const i=await o("/api/staff/"+encodeURIComponent(e)+"/payments",{method:"POST",headers:{"Idempotency-Key":a},body:JSON.stringify(t)});return i.data||i},async exportTeachers(){const e=await o("/api/staff/teachers/export?format=json");return(e.data||e).teachers},async getStaff(){try{const e=await o("/api/staff");return(Array.isArray(e)?e:Array.isArray(e?.staff)?e.staff:[]).map(a=>({id:a.id,fullName:a.fullName,role:a.role,cnic:a.cnic,phone:a.phone,salary:Number(a.salary)||0,joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"2026-01-01",status:a.status||"ACTIVE"}))}catch(e){return console.warn("Staff fetch error:",e),[]}},async createStaff(e){return o("/api/staff",{method:"POST",body:JSON.stringify(e)})},async getPayroll(e){try{const t=e&&e!=="ALL"?`?month=${e}`:"",a=await o(`/api/payroll${t}`);return(Array.isArray(a)?a:Array.isArray(a?.payrollRecords)?a.payrollRecords:[]).map(n=>({id:n.id,staffId:n.staffId,staffName:n.staff?.fullName||n.staffName||"Staff Member",role:n.staff?.role||n.role||"Faculty",month:n.month,amount:Number(n.amount)||0,status:n.status||"PENDING",paidAt:n.paidAt,createdAt:n.createdAt}))}catch(t){return console.warn("Payroll fetch error:",t),[]}},async runPayroll(e){return o("/api/payroll/run",{method:"POST",body:JSON.stringify({month:e})})},async markPayrollPaid(e){return o(`/api/payroll/${e}/mark-paid`,{method:"POST"})},async getTransactions(e){const t=typeof e=="string"?{type:e}:e||{},a=new URLSearchParams;t.page&&a.set("page",String(t.page)),t.limit&&a.set("limit",String(t.limit)),t.type&&t.type!=="ALL"&&a.set("type",t.type),t.status&&t.status!=="ALL"&&a.set("status",t.status),t.source&&t.source!=="ALL"&&a.set("source",t.source),t.search&&t.search.trim()&&a.set("search",t.search.trim()),t.startDate&&t.startDate.trim()&&a.set("startDate",t.startDate.trim()),t.endDate&&t.endDate.trim()&&a.set("endDate",t.endDate.trim()),t.sortBy&&a.set("sortBy",t.sortBy),t.sortOrder&&a.set("sortOrder",t.sortOrder);const i=a.toString()?`?${a.toString()}`:"",n=await o(`/api/transactions${i}`),l=Array.isArray(n?.transactions)?n.transactions:Array.isArray(n?.data?.transactions)?n.data.transactions:Array.isArray(n?.data)?n.data:Array.isArray(n)?n:[],d=n?.pagination||n?.data?.pagination,u=l.map(s=>({id:s.id,type:s.type,amount:s.amount!=null?String(s.amount):"0.00",description:s.description||"",transactionDate:s.transactionDate||s.createdAt,status:s.status||"POSTED",source:s.source||"MANUAL",category:s.category??null,paymentMethod:s.paymentMethod??null,referenceNumber:s.referenceNumber??null,createdById:s.createdById??null,createdByName:s.createdByName??null,createdByEmail:s.createdByEmail??null,voidedAt:s.voidedAt??null,voidedById:s.voidedById??null,voidedByName:s.voidedByName??null,voidedByEmail:s.voidedByEmail??null,voidReason:s.voidReason??null,relatedFeeId:s.relatedFeeId??null,relatedPayrollId:s.relatedPayrollId??null,createdAt:s.createdAt,feeRecord:s.feeRecord??null,payrollRecord:s.payrollRecord??null}));return{transactions:u,pagination:{page:Number(d?.page)||t.page||1,limit:Number(d?.limit)||t.limit||20,total:typeof d?.total=="number"?d.total:u.length,totalPages:Number(d?.totalPages)||Math.ceil(u.length/(t.limit||20))||1}}},async getTransactionSummary(e){const t=new URLSearchParams;e?.type&&e.type!=="ALL"&&t.set("type",e.type),e?.source&&e.source!=="ALL"&&t.set("source",e.source),e?.startDate&&e.startDate.trim()&&t.set("startDate",e.startDate.trim()),e?.endDate&&e.endDate.trim()&&t.set("endDate",e.endDate.trim());const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/transactions/summary${a}`),n=i?.data!==void 0?i.data:i;return{currency:n?.currency||"PKR",totalIncome:n?.totalIncome!=null?String(n.totalIncome):"0.00",totalExpense:n?.totalExpense!=null?String(n.totalExpense):"0.00",netMovement:n?.netMovement!=null?String(n.netMovement):"0.00",postedCount:typeof n?.postedCount=="number"?n.postedCount:0,voidedCount:typeof n?.voidedCount=="number"?n.voidedCount:0,period:{startDate:n?.period?.startDate??e?.startDate??null,endDate:n?.period?.endDate??e?.endDate??null}}},async getTransactionById(e){const t=await o(`/api/transactions/${e}`),a=t?.data!==void 0?t.data:t;return{id:a.id,type:a.type,amount:a.amount!=null?String(a.amount):"0.00",description:a.description||"",transactionDate:a.transactionDate||a.createdAt,status:a.status||"POSTED",source:a.source||"MANUAL",category:a.category??null,paymentMethod:a.paymentMethod??null,referenceNumber:a.referenceNumber??null,createdById:a.createdById??null,createdByName:a.createdByName??null,createdByEmail:a.createdByEmail??null,voidedAt:a.voidedAt??null,voidedById:a.voidedById??null,voidedByName:a.voidedByName??null,voidedByEmail:a.voidedByEmail??null,voidReason:a.voidReason??null,relatedFeeId:a.relatedFeeId??null,relatedPayrollId:a.relatedPayrollId??null,createdAt:a.createdAt,feeRecord:a.feeRecord??null,payrollRecord:a.payrollRecord??null}},async createManualTransaction(e,t){const a={};t&&t.trim()&&(a["Idempotency-Key"]=t.trim());const i=await o("/api/transactions",{method:"POST",headers:a,body:JSON.stringify(e)}),n=i?.data!==void 0?i.data:i;return{id:n.id,type:n.type,amount:n.amount!=null?String(n.amount):"0.00",description:n.description||"",transactionDate:n.transactionDate||n.createdAt,status:n.status||"POSTED",source:n.source||"MANUAL",category:n.category??null,paymentMethod:n.paymentMethod??null,referenceNumber:n.referenceNumber??null,createdById:n.createdById??null,createdByName:n.createdByName??null,createdByEmail:n.createdByEmail??null,voidedAt:n.voidedAt??null,voidedById:n.voidedById??null,voidedByName:n.voidedByName??null,voidedByEmail:n.voidedByEmail??null,voidReason:n.voidReason??null,relatedFeeId:n.relatedFeeId??null,relatedPayrollId:n.relatedPayrollId??null,createdAt:n.createdAt,feeRecord:n.feeRecord??null,payrollRecord:n.payrollRecord??null}},async voidTransaction(e,t){const a=await o(`/api/transactions/${e}/void`,{method:"POST",body:JSON.stringify({reason:t.trim()})}),i=a?.data!==void 0?a.data:a;return{id:i.id,type:i.type,amount:i.amount!=null?String(i.amount):"0.00",description:i.description||"",transactionDate:i.transactionDate||i.createdAt,status:i.status||"VOIDED",source:i.source||"MANUAL",category:i.category??null,paymentMethod:i.paymentMethod??null,referenceNumber:i.referenceNumber??null,createdById:i.createdById??null,createdByName:i.createdByName??null,createdByEmail:i.createdByEmail??null,voidedAt:i.voidedAt??null,voidedById:i.voidedById??null,voidedByName:i.voidedByName??null,voidedByEmail:i.voidedByEmail??null,voidReason:i.voidReason??null,relatedFeeId:i.relatedFeeId??null,relatedPayrollId:i.relatedPayrollId??null,createdAt:i.createdAt,feeRecord:i.feeRecord??null,payrollRecord:i.payrollRecord??null}},async deleteTransaction(e){return await o(`/api/transactions/${e}`,{method:"DELETE"}),!0},async getUsers(e){return(await this.getUserDirectory(e)).users.map(a=>({id:a.id,name:a.name,email:a.email,role:a.role,status:a.status,createdAt:a.createdAt,updatedAt:a.updatedAt}))},async getUserDirectory(e){const t=new URLSearchParams;e?.search?.trim()&&t.set("search",e.search.trim()),e?.role&&e.role!=="ALL"&&t.set("role",e.role),e?.status&&e.status!=="ALL"&&t.set("status",e.status),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit));const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/users${a}`),n=i?.data??i,l=Array.isArray(n?.users)?n.users:Array.isArray(n?.items)?n.items:Array.isArray(n)?n:[],d=n?.pagination||i?.pagination,u=l.map(c=>({id:c.id,name:c.name||(c.email?c.email.split("@")[0]:""),email:c.email||"",role:c.role,status:c.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:c.createdAt||"",updatedAt:c.updatedAt||""})),s={page:Number(d?.page)||1,limit:Number(d?.limit)||e?.limit||20,total:Number(d?.total)||u.length,totalPages:Number(d?.totalPages)||(d?.total?Math.ceil(d.total/(Number(d?.limit)||20)):1)};return{users:u,pagination:s}},async getUserById(e){const t=await o(`/api/users/${e}`),a=t?.data??t;return{id:a.id,name:a.name||"",email:a.email||"",role:a.role,status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||""}},async createUser(e){const t=await o("/api/users",{method:"POST",body:JSON.stringify(e)}),a=t?.data||t;return{id:a.id||`usr_${Date.now()}`,name:a.name||e.name,email:a.email||e.email,role:a.role||e.role,status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString(),updatedAt:a.updatedAt||new Date().toISOString()}},async updateUserAccount(e,t){const a=await o(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{id:i.id||e,name:i.name||"",email:i.email||"",role:i.role,status:i.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:i.createdAt||"",updatedAt:i.updatedAt||new Date().toISOString()}},async updateUser(e,t){const a=await o(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{id:i.id||e,name:i.name||"",email:i.email||"",role:i.role,status:i.status||"ACTIVE",createdAt:i.createdAt||new Date().toISOString()}},async deleteUser(e){return{success:!0,message:(await o(`/api/users/${e}`,{method:"DELETE"}))?.message||"User account deleted successfully"}},async getAnnouncements(){const e=await o("/api/announcements/admin");return{configured:e?.configured??!0,items:Array.isArray(e?.items)?e.items:[]}},async createAnnouncement(e){const t=await o("/api/announcements/admin",{method:"POST",body:JSON.stringify(e)});return t?.data||t},async updateAnnouncement(e,t){const a=await o(`/api/announcements/admin/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async deleteAnnouncement(e){const t=await o(`/api/announcements/admin/${e}`,{method:"DELETE"});return t?.data||t||{success:!0,id:e}},async getTestCenters(){const e=await o("/api/test-centers");if(!Array.isArray(e))throw new Error("Invalid test centers response.");return e.map(a=>({id:a.id,name:a.name,code:a.code,campus:a.campus,address:a.address,district:a.district,province:a.province,capacity:a.capacity,reportingTime:a.reportingTime,testDate:a.testDate,contactPerson:a.contactPerson||"",contactPhone:a.contactPhone||"",status:a.status,createdAt:a.createdAt,assignedCount:a.assignedCount}))},async createTestCenter(e){const t=await o("/api/test-centers",{method:"POST",body:JSON.stringify(e)});return t&&(t.data||t)||e},async updateTestCenter(e,t){const a=await o(`/api/test-centers/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a&&(a.data||a)||{id:e,...t}},async deleteTestCenter(e){return await o(`/api/test-centers/${e}`,{method:"DELETE"}),!0},async getStudentDocumentsPage(e=1,t=24,a){const i=new URLSearchParams({page:String(e),limit:String(t)});a&&i.set("studentId",a);const n=await o(`/api/students/documents?${i.toString()}`);if(Array.isArray(n?.documents)){const r={photo:"CANDIDATE_PHOTO",bform:"CNIC_BFORM",fatherCnic:"GUARDIAN_CNIC",dmc:"PREVIOUS_DMC",domicile:"DOMICILE",paymentReceipt:"PAYMENT_CHALLAN"},g=n.documents.map(p=>({id:p.id,studentId:p.studentId,studentName:p.studentName,rollNumber:p.rollNumber,applicationNo:p.applicationNo,currentClass:p.currentClass,docType:r[p.documentType]||"PREVIOUS_DMC",storageDocType:p.documentType,title:p.originalFileName||`${p.documentType} document`,fileUrl:"",fileEndpoint:p.fileEndpoint,fileSize:p.byteSize?`${Math.ceil(p.byteSize/1024)} KB`:"Stored attachment",fileType:p.mimeType,uploadedAt:p.uploadedAt,status:p.eligibility==="ELIGIBLE"?"VERIFIED":p.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",rejectionReason:p.eligibilityRemarks}));return{documents:g,pagination:n.pagination||{page:e,limit:t,total:g.length,totalPages:1}}}const l=await this.getStudents(),d=new Map;l.forEach(r=>{const g=a?a.toLowerCase().trim():"",p=a?a.replace(/\D/g,""):"";if(!(!a||r.id?.toLowerCase()===g||r.applicationNo?.toLowerCase()===g||r.rollNumber?.toLowerCase()===g||p.length>=5&&r.cnicOrBForm&&r.cnicOrBForm.replace(/\D/g,"")===p))return;let m=r.uploadedDocuments;if(typeof m=="string")try{m=JSON.parse(m)}catch{}if(!m&&r.uploadedDocsJson)try{m=JSON.parse(r.uploadedDocsJson)}catch{}m=m||{};const w=r.applicationNo||r.id,R=r.officeUse,T=R?.eligibility==="ELIGIBLE"?"VERIFIED":R?.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",I=R?.eligibilityRemarks,C=m.photo||m.photoUploaded||m.passportPhoto||m.candidatePhoto||m.profilePhoto;if(C||r.photoUrl){const S=C?.dataUrl?.startsWith("data:")||r.photoUrl?.startsWith("data:");d.set(`${w}_PHOTO`,{id:`doc_photo_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"CANDIDATE_PHOTO",storageDocType:"photo",title:C?.name||`${r.fullName}_Passport_Photo.jpg`,fileUrl:S?C?.dataUrl||r.photoUrl:"",fileEndpoint:`/api/students/${r.id}/document/photo`,fileSize:C?.size||(C?.byteSize?`${Math.ceil(C.byteSize/1024)} KB`:"Candidate Photo"),fileType:"image/jpeg",uploadedAt:C?.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}const y=m.bform||m.bformUploaded||m.cnic||m.candidateCnic;if(y){const S=y.name?.endsWith(".pdf")||y.mimeType==="application/pdf"||y.dataUrl?.includes("application/pdf");d.set(`${w}_BFORM`,{id:`doc_cnic_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"bform",title:y.name||`${r.fullName}_Candidate_BForm_CNIC.jpg`,fileUrl:y.dataUrl?.startsWith("data:")?y.dataUrl:"",fileEndpoint:`/api/students/${r.id}/document/bform`,fileSize:y.size||(y.byteSize?`${Math.ceil(y.byteSize/1024)} KB`:"Candidate Attachment"),fileType:S?"application/pdf":"image/jpeg",uploadedAt:y.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}const h=m.fatherCnic||m.fatherCnicUploaded||m.fcnic;if(h){const S=h.name?.endsWith(".pdf")||h.mimeType==="application/pdf"||h.dataUrl?.includes("application/pdf");d.set(`${w}_FATHER_CNIC`,{id:`doc_fcnic_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"fatherCnic",title:h.name||`${r.fullName}_Father_CNIC.jpg`,fileUrl:h.dataUrl?.startsWith("data:")?h.dataUrl:"",fileEndpoint:`/api/students/${r.id}/document/fatherCnic`,fileSize:h.size||(h.byteSize?`${Math.ceil(h.byteSize/1024)} KB`:"Candidate Attachment"),fileType:S?"application/pdf":"image/jpeg",uploadedAt:h.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}const b=m.dmc||m.dmcUploaded||m.resultCard||m.previousResult;if(b){const S=b.name?.endsWith(".pdf")||b.mimeType==="application/pdf"||b.dataUrl?.includes("application/pdf");d.set(`${w}_DMC`,{id:`doc_dmc_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"PREVIOUS_DMC",storageDocType:"dmc",title:b.name||`${r.fullName}_DMC_Marksheet.jpg`,fileUrl:b.dataUrl?.startsWith("data:")?b.dataUrl:"",fileEndpoint:`/api/students/${r.id}/document/dmc`,fileSize:b.size||(b.byteSize?`${Math.ceil(b.byteSize/1024)} KB`:"Candidate Attachment"),fileType:S?"application/pdf":"image/jpeg",uploadedAt:b.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}const A=m.paymentReceipt||m.incomeCertUploaded||m.receipt||m.challan;if(A){const S=A.name?.endsWith(".pdf")||A.mimeType==="application/pdf"||A.dataUrl?.includes("application/pdf");d.set(`${w}_FEE`,{id:`doc_pay_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"PAYMENT_CHALLAN",storageDocType:"paymentReceipt",title:A.name||`${r.fullName}_Fee_Payment_Receipt.jpg`,fileUrl:A.dataUrl?.startsWith("data:")?A.dataUrl:"",fileEndpoint:`/api/students/${r.id}/document/paymentReceipt`,fileSize:A.size||(A.byteSize?`${Math.ceil(A.byteSize/1024)} KB`:"Candidate Attachment"),fileType:S?"application/pdf":"image/jpeg",uploadedAt:A.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}const v=m.domicile||m.domicileUploaded;if(v){const S=v.name?.endsWith(".pdf")||v.mimeType==="application/pdf"||v.dataUrl?.includes("application/pdf");d.set(`${w}_DOMICILE`,{id:`doc_dom_${r.id}`,studentId:r.id,studentName:r.fullName,rollNumber:r.rollNumber||"PENDING",applicationNo:r.applicationNo||"APP-2026",currentClass:r.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"domicile",title:v.name||`${r.fullName}_Domicile_Certificate.jpg`,fileUrl:v.dataUrl?.startsWith("data:")?v.dataUrl:"",fileEndpoint:`/api/students/${r.id}/document/domicile`,fileSize:v.size||(v.byteSize?`${Math.ceil(v.byteSize/1024)} KB`:"Candidate Attachment"),fileType:S?"application/pdf":"image/jpeg",uploadedAt:v.uploadedAt||r.createdAt||new Date().toISOString(),status:T,rejectionReason:I})}});const u=Array.from(d.values()),s=u.length,c=Math.max(1,Math.ceil(s/t)),f=Math.min(Math.max(1,e),c);return{documents:u.slice((f-1)*t,f*t),pagination:{page:f,limit:t,total:s,totalPages:c}}},async getStudentDocuments(e){return(await this.getStudentDocumentsPage(1,50,e)).documents},async updateDocumentStatus(e,t,a,i){if(i)try{return await o(`/api/students/${i}/office-use`,{method:"PATCH",body:JSON.stringify({documentVerifiedBy:t==="VERIFIED"?"Admin Reviewer":void 0,documentVerifiedAt:t==="VERIFIED"?new Date().toISOString():void 0,eligibility:t==="VERIFIED"?"ELIGIBLE":t==="REJECTED"?"NOT_ELIGIBLE":void 0,eligibilityRemarks:a})}),!0}catch(n){return console.warn("Backend office-use document verification sync notice:",n),!1}return!0}};function se(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your official registration slip.");return}const a=e.applicationNo||e.id||`APP-2026-${Math.floor(1e3+Math.random()*9e3)}`,i=e.createdAt?new Date(e.createdAt).toLocaleDateString():new Date().toLocaleDateString(),n=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Scholarship Registration Slip - ${a}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f8fafc; padding: 24px; }
    .slip-container { max-width: 800px; margin: 0 auto; background: #fff; border: 2px solid #185b9d; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #185b9d; padding-bottom: 16px; margin-bottom: 20px; }
    .title-area h1 { font-size: 22px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .title-area p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; }
    .candidate-banner { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; align-items: center; }
    .photo-frame { width: 96px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
    .meta-title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #185b9d; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .fee-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .fee-title { color: #166534; font-size: 14px; font-weight: 800; margin-bottom: 6px; }
    .pay-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .pay-card { background: #fff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 12px; }
    .notice-box { font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 14px; line-height: 1.6; }
    .notice-box ul { margin-left: 18px; margin-top: 4px; }
    .btn-bar { text-align: center; margin-top: 24px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .slip-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header">
      <div class="title-area">
        <h1>AZM.AIO SCHOLARSHIP PORTAL</h1>
        <p>Session V (2026) Official Registration Confirmation Slip & Challan</p>
      </div>
      <div style="text-align: right;">
        <span class="badge">Application Submitted ✓</span>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dated: ${i}</div>
      </div>
    </div>

    <div class="candidate-banner" style="justify-content: space-between;">
      <div style="display: flex; gap: 16px; align-items: center;">
        <div class="photo-frame">
          ${e.photoUrl?`<img src="${e.photoUrl}" alt="Photo" />`:'<span style="font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.2;">Candidate<br/>Photo</span>'}
        </div>
        <div>
          <div class="meta-title">${e.fullName||"Candidate Name"}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${e.fatherName||"Father Name"}</strong></div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">CNIC / B-Form: <strong style="font-family: monospace;">${e.cnicOrBForm||e.cnicBForm||"N/A"}</strong></div>
          <div style="font-size: 12px; color: #185b9d; font-weight: 800; margin-top: 4px;">Application Reference: ${a}</div>
        </div>
      </div>
      <div style="text-align: center; flex-shrink: 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(e.rollNumber||a)}" alt="QR" style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" />
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">BIOMETRIC QR</div>
      </div>
    </div>


    <div class="grid">
      <div class="info-card">
        <div class="info-label">Applied Grade / Level</div>
        <div class="info-value">${e.currentClass||"SSC / HSSC"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Discipline / Group</div>
        <div class="info-value">${e.discipline||e.hsscGroup||"Science / General"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">School / College</div>
        <div class="info-value">${e.schoolName||"Enrolled School"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">District & Province</div>
        <div class="info-value">${e.district||"Mansehra"}, ${e.province||"Khyber Pakhtunkhwa"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Candidate Contact</div>
        <div class="info-value" style="font-family: monospace;">${e.studentMobile||e.mobile||"0300-XXXXXXX"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Parent / Guardian Contact</div>
        <div class="info-value" style="font-family: monospace;">${e.parentMobile||e.emergencyContact||"0300-XXXXXXX"}</div>
      </div>
    </div>

    <div class="fee-box">
      <div class="fee-title">Official PKR 300 Registration Fee Payment Details</div>
      <p style="font-size: 11px; color: #15803d; line-height: 1.4;">
        To activate your biometric Roll Number Slip and examination seat for Session V (2026), deposit <strong>PKR 300</strong> through any of the verified channels:
      </p>
      <div class="pay-methods">
        <div class="pay-card">
          <strong style="color: #15803d;">📱 EasyPaisa / JazzCash:</strong><br/>
          Account: <strong style="font-family: monospace; color: #0f172a;">03440197194</strong><br/>
          Title: <strong>Sumama Khan</strong>
        </div>
        <div class="pay-card">
          <strong style="color: #15803d;">🏦 Bank Alfalah (IBFT):</strong><br/>
          Account: <strong style="font-family: monospace; color: #0f172a;">83861010161490</strong><br/>
          Title: <strong>Sumama Khan</strong>
        </div>
      </div>
      <p style="font-size: 10px; color: #166534; margin-top: 6px; font-weight: 600;">
        Send payment screenshot with your Application ID (${a}) to WhatsApp <strong>0305-1755551</strong> for clearance.
      </p>
    </div>

    <div class="notice-box">
      <strong>Important Guidelines:</strong>
      <ul>
        <li>Retain this official confirmation slip for your records.</li>
        <li>Your Roll Number Slip with test center assignment will be issued once payment is verified.</li>
        <li>Helpline / Support: <strong>0305-1755551</strong> / <strong>azmgoc30@gmail.com</strong>.</li>
      </ul>
    </div>

    <div class="btn-bar">
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  <\/script>
</body>
</html>
  `;t.document.open(),t.document.write(n),t.document.close()}function Z(e){const t=e.placementStatus==="ASSIGNED"&&!!e.assignedHallId;if(e.rollNumber&&(!t||!e.assignedRoom||!e.seatNo||!e.testDate||!e.reportingTime)){alert("PLACEMENT_PENDING: Examination placement is not yet available.");return}const a=window.open("","_blank");if(!a){alert("Please allow popups to open and print your official Roll Number Slip.");return}const i=e.rollNumber||e.officeUse?.testRollNo||`PROV-${e.applicationNo||e.id||"UNASSIGNED"}`,n=t&&e.testDate||"To be announced",l=t&&e.reportingTime||"To be announced",d=t&&e.assignedHall||"To be assigned",u=t&&e.assignedRoom||"To be assigned",s=t&&e.seatNo||"To be assigned",c=t&&e.testCenterName||"To be assigned",f=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Examination Entry Pass - Roll Slip ${i}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f8fafc; padding: 24px; }
    .slip-container { max-width: 800px; margin: 0 auto; background: #fff; border: 2px solid #185b9d; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #185b9d; padding-bottom: 14px; margin-bottom: 18px; }
    .title-area h1 { font-size: 20px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .title-area p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .badge { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; }
    .candidate-banner { display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 18px; align-items: center; justify-content: space-between; }
    .photo-frame { width: 96px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
    .meta-title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .roll-highlight { font-size: 22px; font-weight: 900; color: #185b9d; font-family: monospace; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #185b9d; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .exam-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    .exam-title { color: #166534; font-size: 13px; font-weight: 800; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .notice-box { font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 12px; line-height: 1.6; }
    .notice-box ul { margin-left: 18px; margin-top: 4px; }
    .btn-bar { text-align: center; margin-top: 24px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .slip-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header">
      <div class="title-area">
        <h1>AZM.AIO SCHOLARSHIP & EXAMINATION AUTHORITY</h1>
        <p>Session V (2026) Official Standardized Examination Roll Number Slip & Entry Pass</p>
      </div>
      <div style="text-align: right;">
        <span class="badge">Verified Candidate Entry Pass ✓</span>
      </div>
    </div>

    <div class="candidate-banner">
      <div style="display: flex; gap: 16px; align-items: center;">
        <div class="photo-frame">
          ${e.photoUrl?`<img src="${e.photoUrl}" alt="Photo" />`:'<span style="font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.2;">Candidate<br/>Photo</span>'}
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">OFFICIAL ROLL NUMBER</div>
          <div class="roll-highlight">${i}</div>
          <div class="meta-title" style="margin-top: 4px;">${e.fullName||"Candidate Name"}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${e.fatherName||"Father Name"}</strong></div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">CNIC / B-Form: <strong style="font-family: monospace;">${e.cnicOrBForm||e.cnicBForm||"N/A"}</strong></div>
        </div>
      </div>
      <div style="text-align: center; flex-shrink: 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(i)}" alt="QR" style="width: 85px; height: 85px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" />
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">BIOMETRIC QR PASS</div>
      </div>
    </div>

    <div class="exam-box">
      <div class="exam-title">🎯 Examination Hall & Venue Assignment</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
        <div>📅 <strong>Exam Date:</strong> ${n}</div>
        <div>⏰ <strong>Reporting Time:</strong> ${l}</div>
        <div>🏛️ <strong>Exam Hall:</strong> ${d}</div>
        <div>🚪 <strong>Room & Seat:</strong> ${u} — ${s}</div>
        <div style="grid-column: 1 / -1; margin-top: 4px;">📍 <strong>Examination Centre:</strong> ${c}</div>
      </div>
    </div>

    <div class="grid">
      <div class="info-card">
        <div class="info-label">Candidate Class / Grade</div>
        <div class="info-value">${e.currentClass||"SSC / HSSC"}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Scholarship Stream / Quota</div>
        <div class="info-value">${(e.scholarshipCategory||"GENERAL_MERIT").replace(/_/g," ")}</div>
      </div>
    </div>

    <div class="notice-box">
      <strong>Mandatory Examination Hall Instructions:</strong>
      <ul>
        <li>Candidate must bring this printed Roll Number Slip along with original CNIC / B-Form / School ID card.</li>
        <li>Reach the examination center at least 30 minutes before the scheduled start time.</li>
        <li>Calculators, mobile phones, and electronic smartwatches are strictly prohibited in the exam hall.</li>
        <li>Central Directorate Helpline: <strong>0305-1755551</strong> | <strong>azmgoc30@gmail.com</strong></li>
      </ul>
    </div>

    <div class="btn-bar">
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  <\/script>
</body>
</html>
  `;a.document.open(),a.document.write(f),a.document.close()}function de(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your full student dossier.");return}const a=e.applicationNo||e.studentId||e.id||"APP-2026-0101",i=e.rollNumber||"AZMVS-2026-0101",n=e.createdAt?new Date(e.createdAt).toLocaleDateString():new Date().toLocaleDateString(),l=e.photoUrl?`<img src="${e.photoUrl}" alt="${e.fullName||"Candidate"} photo" style="width: 100%; height: 100%; object-fit: cover;" />`:'<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #64748b; font-size: 10px; font-weight: 800; text-align: center;">NO PHOTO<br/>AVAILABLE</div>',d=e.qrImageUrl||`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(i)}`,u=Array.isArray(e.academicRecords)?e.academicRecords:[],s=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Student Profile Dossier - ${i} (${e.fullName})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { background: #f1f5f9; padding: 24px; }
    .dossier-card { max-width: 860px; margin: 0 auto; background: #fff; border: 2px solid #0f172a; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: 900; color: #185b9d; letter-spacing: -0.5px; }
    .header p { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; }
    .sec-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #185b9d; background: #f0f7ff; border-left: 4px solid #185b9d; padding: 6px 12px; border-radius: 4px; margin: 16px 0 10px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
    .val { font-size: 12px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    th { background: #0f172a; color: #fff; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 16px; border-top: 2px solid #0f172a; font-size: 10px; color: #64748b; }
    .btn-bar { text-align: center; margin-top: 24px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .dossier-card { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="dossier-card">
    <div class="header">
      <div>
        <h1>AZM ACADEMIC INITIATIVE ORGANIZATION</h1>
        <p>Session V (2026) Official Student Application Profile & Academic Dossier</p>
      </div>
      <div style="text-align: right;">
        <img src="${d}" alt="QR" style="width: 70px; height: 70px; border-radius: 6px; border: 1px solid #cbd5e1; padding: 2px;" />
        <div style="font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 2px;">${i}</div>
      </div>
    </div>

    <div style="display: flex; gap: 18px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
      <div style="width: 90px; height: 100px; border-radius: 8px; border: 2px solid #0f172a; overflow: hidden; background: #fff; flex-shrink: 0;">
        ${l}
      </div>
      <div style="flex: 1;">
        <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${e.fullName||"Candidate Name"}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${e.fatherName||"Father Name"}</strong></div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Candidate CNIC / B-Form: <strong style="font-family: monospace; color: #185b9d;">${e.cnicOrBForm||"N/A"}</strong></div>
        <div style="display: flex; gap: 10px; margin-top: 6px; font-size: 11px;">
          <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: bold;">Class: ${e.currentClass||"SSC"}</span>
          <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; font-weight: bold;">Fee: ${e.feeStatus==="PAID"?"PAID (PKR 300)":"PENDING VERIFICATION"}</span>
          <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-weight: bold;">App Ref: ${a}</span>
        </div>
      </div>
    </div>

    <div class="sec-title">Part A & B: Personal Details & Contact Coordinates</div>
    <div class="grid-3">
      <div class="item"><div class="label">Date of Birth / Age</div><div class="val">${e.dateOfBirth||"2008-04-12"} (${e.age||"16"} yrs)</div></div>
      <div class="item"><div class="label">Gender</div><div class="val">${e.gender||"Male"}</div></div>
      <div class="item"><div class="label">Domicile District & Province</div><div class="val">${e.district||"Mansehra"}, ${e.province||"KP"}</div></div>
    </div>
    <div class="grid-3">
      <div class="item"><div class="label">Candidate Mobile / WhatsApp</div><div class="val" style="font-family: monospace;">${e.whatsapp||e.mobile||"0300-XXXXXXX"}</div></div>
      <div class="item"><div class="label">Father / Guardian Mobile</div><div class="val" style="font-family: monospace; color: #185b9d;">${e.parentMobile||e.emergencyContact||"0305-1755551"}</div></div>
      <div class="item"><div class="label">Email Address</div><div class="val">${e.email||"student@azmaio.com"}</div></div>
    </div>
    <div class="item" style="margin-bottom: 10px;">
      <div class="label">Residential Postal Address</div>
      <div class="val">${e.address||"Main City, Mansehra, Khyber Pakhtunkhwa"}</div>
    </div>

    <div class="sec-title">Part C: Complete Multi-Class Academic History & Scores</div>
    <table>
      <thead>
        <tr>
          <th>Class / Grade Level</th>
          <th>Passing Year</th>
          <th>School / College Institution</th>
          <th>Board / Assessment</th>
          <th>Max Marks</th>
          <th>Obt. Marks</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${u.length>0?u.map(c=>`
          <tr>
            <td><strong>${c.examLevel||"—"}</strong></td>
            <td>${c.yearOfPassing||c.year||"—"}</td>
            <td>${c.institute||c.boardOrUni||"—"}</td>
            <td>${c.boardOrUni||c.board||"—"}</td>
            <td>${c.totalMarks!=null?c.totalMarks:"—"}</td>
            <td><strong>${c.obtainedMarks!=null?c.obtainedMarks:"—"}</strong></td>
            <td><strong style="color: #15803d;">${c.percentage!=null?`${c.percentage}%`:"—"}</strong></td>
          </tr>
        `).join(""):`
          <tr>
            <td colspan="7" style="text-align: center; padding: 14px; color: #64748b; font-size: 11px;">No previous qualification records on file for this candidate.</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="sec-title">Part D & E: Scholarship Stream & Examination Center Allocation</div>
    <div class="grid-2">
      <div class="item"><div class="label">Scholarship Stream</div><div class="val" style="color: #185b9d;">${e.scholarshipCategory||"Category B: Academic Merit Waiver"}</div></div>
      <div class="item"><div class="label">Enrolled Institution</div><div class="val">${e.schoolName||"Partner School"}</div></div>
    </div>
    <div class="grid-2">
      <div class="item"><div class="label">Assigned Examination Center</div><div class="val">${e.officeUse?.testCentre||"AZM Examination Center - Mansehra Main Campus"}</div></div>
      <div class="item"><div class="label">Test Reporting Date & Time</div><div class="val">${e.officeUse?.testDate||"Sunday, 15 November 2026"} @ ${e.officeUse?.testReportingTime||"09:00 AM"}</div></div>
    </div>

    <div class="footer">
      <div>
        <div>Security Authentication Hash: <strong>SHA256-${i}</strong></div>
        <div>System Verified: ${n} | AZM.AIO Testing Service</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: bold; border-top: 1px solid #0f172a; padding-top: 4px; display: inline-block; min-width: 160px; text-align: center;">
          Director General (Examinations)
        </div>
      </div>
    </div>

    <div class="btn-bar">
      <button class="btn" onclick="window.print()">🖨️ Print Full Candidate Dossier</button>
    </div>
  </div>

  <script>
    window.onload = function() {
      var images = Array.prototype.slice.call(document.images);
      var imageLoads = images.map(function(image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      });

      Promise.all(imageLoads).then(function() {
        setTimeout(function() {
          window.print();
        }, 150);
      });
    };
  <\/script>
</body>
</html>
  `;t.document.open(),t.document.write(s),t.document.close()}export{pe as API_BASE_URL,ee as DEFAULT_TEST_CENTERS,j as canonicalReleaseDateTime,J as fetchRollNumberReleaseConfig,ie as formatReleaseDateTime,te as getCanonicalStudentKey,re as getRollNumberReleaseConfig,G as isReleaseConfigReleased,X as isRollNumberReleased,oe as mockApi,O as parseReleaseDateTime,Z as printRollNumberSlip,de as printStudentDossier,se as printStudentSlip,ne as releaseDateTimeToPakistanInput,K as saveRollNumberReleaseConfig,ae as saveUploadedFilesForCandidate};
