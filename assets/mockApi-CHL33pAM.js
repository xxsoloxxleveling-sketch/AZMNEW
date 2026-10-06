import{a as o,c as P,d as R,g as $,e as B,s as O,f as k,h as U}from"./index-Btznd1wo.js";import{A as ae}from"./index-Btznd1wo.js";import"./vendor-icons-UDZfnsJQ.js";import"./vendor-react-Dmxn492p.js";import"./vendor-globe-BTOyu2GH.js";let w=B()||null;const M=new Map,X=[{id:"tc-1",name:"AZM Central Examination Center - Mansehra",code:"TC-MHR-01",campus:"Main College Road Campus",address:"Near College Chowk, Karakoram Highway, Mansehra",district:"Mansehra",province:"Khyber Pakhtunkhwa",capacity:450,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Prof. Dr. Sumama Khan",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-10T00:00:00Z"},{id:"tc-2",name:"Govt Post Graduate College No. 1 - Abbottabad",code:"TC-ATD-02",campus:"Main College Campus",address:"College Road, Near Mandian, Abbottabad",district:"Abbottabad",province:"Khyber Pakhtunkhwa",capacity:350,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Admissions & Testing Coordinator",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-12T00:00:00Z"},{id:"tc-3",name:"Hazara Public School & College Center - Haripur",code:"TC-HRP-03",campus:"Central Hall",address:"Main G.T Road, Haripur, Khyber Pakhtunkhwa",district:"Haripur",province:"Khyber Pakhtunkhwa",capacity:300,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Controller of Examination",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-15T00:00:00Z"},{id:"tc-4",name:"Khyber Public School & College Regional Hub - Battagram",code:"TC-BTG-04",campus:"City Campus",address:"Karakoram Highway, Battagram",district:"Battagram",province:"Khyber Pakhtunkhwa",capacity:220,reportingTime:"09:00 AM",testDate:"Sunday, 15 November 2026",contactPerson:"Regional Coordinator",contactPhone:"0305-1755551",status:"ACTIVE",createdAt:"2025-01-20T00:00:00Z"}];function K(e){if(e.cnicOrBForm){const t=e.cnicOrBForm.replace(/\D/g,"");if(t.length>=5)return`CNIC_${t}`}return e.applicationNo&&e.applicationNo.trim()?e.applicationNo.trim().toUpperCase():e.rollNumber&&e.rollNumber.trim()?e.rollNumber.trim().toUpperCase():e.fullName&&e.fatherName?`NAME_${e.fullName.trim().toLowerCase()}_${e.fatherName.trim().toLowerCase()}`:e.id?e.id.trim().toLowerCase():`STD_${Math.random()}`}function Z(e,t){}const L={isScheduled:!1,releaseDateTime:"2026-10-15T09:00:00",announcementTitle:"Roll Number Slips Official Release Schedule",announcementMessage:"Official Roll Number Slips, Assigned Test Centers, and Examination Hall seatings are live.",emergencyNotice:"Your registration and fee verification are permanently confirmed in the examination registry.",examCenterName:"Dubai International School and College Boys Campus Mansehra",examDate:"2026-11-15",femaleReportingTime:"08:00",femaleTestStartTime:"09:00",femaleTestEndTime:"10:00",maleReportingTime:"11:00",maleTestStartTime:"12:00",maleTestEndTime:"13:00",updatedAt:"2026-08-24T00:00:00Z"};let S={...L};async function F(){try{const e=await o("/api/students/release-config"),t=e?.data||e;if(t&&typeof t.isScheduled=="boolean")return S={...L,...t},S}catch(e){console.warn("Failed to fetch roll number release config from live server:",e)}return S}function W(){return S}async function z(e){const t={...S,...e,updatedAt:new Date().toISOString()};S=t;try{const a=await o("/api/students/release-config",{method:"POST",body:JSON.stringify(t)}),i=a?.data||a||t;return S=i,i}catch(a){return console.warn("Failed to persist release config to backend:",a),t}}function _(){if(!S.isScheduled||!S.releaseDateTime)return!0;const e=new Date(S.releaseDateTime).getTime();return Date.now()>=e}const Q={async login(e,t){const a=await o("/api/auth/login",{method:"POST",body:JSON.stringify({email:e,password:t})}),i={id:a.user.id,name:a.user.name||a.user.email.split("@")[0],email:a.user.email,role:a.user.role,avatarUrl:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"};return k(a.accessToken),a.refreshToken&&U(a.refreshToken),O(i),w=i,{user:i,token:a.accessToken,role:i.role}},async getCurrentUser(){if(w||(w=B()),!$())return w;try{const t=await o("/api/auth/me");t&&t.user&&(w={...t.user,avatarUrl:t.user.avatarUrl||"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"},O(w))}catch{}return w},async getDashboardOverview(){const e=await o("/api/dashboard/overview"),t=await o("/api/fees?status=UNPAID").catch(()=>[]),a=Array.isArray(t)?t:Array.isArray(t?.feeRecords)?t.feeRecords:[],i=e?.period?.date?new Date(e.period.date):new Date,r=i.getDay(),l=r===0?-6:1-r,d=new Date(i);d.setDate(i.getDate()+l);const u=["Mon","Tue","Wed","Thu","Fri"],s=e?.attendanceToday?.attendancePercentage||0,x=(e?.attendanceToday?.markedCount||0)>0||(e?.stats?.totalStudents||0)>0&&s>0,n=u.map((f,m)=>{const I=new Date(d);I.setDate(d.getDate()+m);const c=I.toDateString()===i.toDateString();return{day:`${f} ${I.getDate()}`,isToday:c,hasSession:c?x:!1,rate:c&&x?s:null}});return{stats:{totalStudents:e.stats?.totalStudents||0,totalPartners:e.stats?.totalPartners??e.partnerStats?.totalPartners??0,pendingPartners:e.stats?.pendingPartners??e.partnerStats?.pendingPartners??0,totalExpectedApplicants:e.stats?.totalExpectedApplicants||0,attendancePercentage:e.attendanceToday?.attendancePercentage||0,feeCollectionPercentage:e.feeCollection?.collectionPercentage||0,activeStaffCount:e.stats?.activeStaffCount||0,totalBilled:e.feeCollection?.totalBilled||0,totalCollected:e.feeCollection?.totalCollected||0,feeIncome:e.financialFlow?.feeIncome||0,salaryExpenses:e.financialFlow?.salaryExpenses||0,netCashFlow:e.financialFlow?.netCashFlow||0},attendanceToday:e.attendanceToday||null,attendanceTrends:n,feeDefaulters:(a||[]).slice(0,5).map(f=>({id:f.id,studentName:f.student?.fullName||f.studentName||"Candidate",rollNumber:f.student?.rollNumber||f.rollNumber||"Pending Approval",currentClass:f.student?.currentClass||f.currentClass||"SSC",amountDue:Number(f.amountDue)||300,status:f.status||"UNPAID"})),recentActivity:[],demographics:{byGender:e.studentDemographics?.byGender||{MALE:0,FEMALE:0},byClassLevel:e.studentDemographics?.byClassLevel||{},byScholarshipCategory:e.studentDemographics?.byScholarshipCategory||{}}}},async getStudentsPage(e){const t=new URLSearchParams;t.append("page",String(e?.page||1)),t.append("limit",String(e?.limit||50)),e?.classLevel&&e?.classLevel!=="ALL"&&t.append("classLevel",e.classLevel),e?.gender&&e?.gender!=="ALL"&&t.append("gender",e.gender),e?.status&&e?.status!=="ALL"&&t.append("status",e.status),e?.search&&e.search.trim()&&t.append("search",e.search.trim());const a=`?${t.toString()}`,i=await o(`/api/students${a}`),l=(Array.isArray(i)?i:Array.isArray(i?.students)?i.students:[]).map(d=>({...d,rollNumber:d.rollNumber||null,feeStatus:d.feeStatus||(d.feeRecords?.length?d.feeRecords[0].status:"UNPAID"),attendancePercentage:d.attendancePercentage}));return{students:l,pagination:i?.pagination||{page:e?.page||1,limit:e?.limit||50,total:l.length,totalPages:1}}},async getStudents(e){return(await this.getStudentsPage({...e,page:1,limit:250})).students},async getStudentById(e){const t=await o(`/api/students/${e}`);return{...t,feeStatus:t.feeStatus||(t.feeRecords?.length?t.feeRecords[0].status:"UNPAID"),attendancePercentage:t.attendancePercentage}},async createStudent(e){return await o("/api/students/register",{method:"POST",body:JSON.stringify(e)})},async uploadStudentDocument(e){const t=(e.cnicOrBForm||e.applicationNo||e.studentId)?.trim();let a;if(!$()){if(!t||t==="TEMP_CANDIDATE")throw new Error("Enter the candidate CNIC or B-Form before uploading documents.");a=M.get(t),a||(a=(await o("/api/students/upload-session",{method:"POST",body:JSON.stringify({cnicOrBForm:t})})).token,M.set(t,a))}let i;const r=e.fileData.match(/^data:([^;]+);base64,(.*)$/s);if(r&&t){const l=atob(r[2]),d=new Uint8Array(l.length);for(let u=0;u<l.length;u++)d[u]=l.charCodeAt(u);i=await o("/api/students/upload-document-binary",{method:"POST",headers:{"Content-Type":e.contentType||r[1],"X-Candidate-Key":t,"X-Document-Type":e.docType,"X-File-Name":encodeURIComponent(e.fileName||`${e.docType}.bin`),...a?{"X-Upload-Session":a}:{}},body:new Blob([d],{type:e.contentType||r[1]})})}else i=await o("/api/students/upload-document",{method:"POST",headers:a?{"X-Upload-Session":a}:void 0,body:JSON.stringify(e)});return i?.data||i},async approveStudentPayment(e){return await o(`/api/students/${e}/approve-payment`,{method:"POST"})||{success:!0}},async getRollNumberStatus(){const e=await o("/api/students/roll-number-status");return e?.data||e},async issueRollNumbers(e){const t=await o("/api/students/issue-roll-numbers",{method:"POST",body:JSON.stringify({scheduledDate:e})});return t?.data||t},async deleteStudent(e){return await o(`/api/students/${e}`,{method:"DELETE"}),!0},async getRollNumberReleaseConfig(){return F()},async updateRollNumberReleaseConfig(e){return z(e)},isRollNumberReleased(){return _()},releaseAllPaidRollNumbers(){return 0},async updateStudent(e,t){const a=await o(`/api/students/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async updateOfficeUse(e,t){return o(`/api/students/${e}/office-use`,{method:"PATCH",body:JSON.stringify(t)})},async getExamHalls(){const e=await o("/api/exam-halls");return Array.isArray(e)?e:Array.isArray(e?.data)?e.data:[]},async createExamHall(e){const t=await o("/api/exam-halls",{method:"POST",body:JSON.stringify(e)});return t&&(t.data||t)||e},async updateExamHall(e,t){const a=await o(`/api/exam-halls/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a&&(a.data||a)||{id:e,...t}},async deleteExamHall(e){return await o(`/api/exam-halls/${e}`,{method:"DELETE"}),!0},async updateStudentAllocation(e,t){const a=await o(`/api/exam-halls/students/${e}/allocation`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async batchAssignStudentsToHall(e,t,a){return(await o(`/api/exam-halls/${e}/batch-assign`,{method:"POST",body:JSON.stringify({studentIds:a,hallName:t.hallName,roomNumber:t.roomNumber,testCenterName:t.testCenterName})}))?.count||a.length},async unassignStudentFromHall(e){return await o(`/api/exam-halls/students/${e}/allocation`,{method:"DELETE"}),!0},async downloadStudentPdf(e,t,a){if(!e)throw new Error("Student identifier is required to download the registration slip.");const i={};a?.cnicOrBForm&&(i["X-Candidate-CNIC"]=String(a.cnicOrBForm).trim()),await P(`/api/students/${encodeURIComponent(e)}/registration-pdf`,`AZM-Registration-${t||e}.pdf`,{headers:i})},async printStudentRegistrationPdf(e,t){if(!e)throw new Error("Student identifier is required to print the registration slip.");const a={};t?.cnicOrBForm&&(a["X-Candidate-CNIC"]=String(t.cnicOrBForm).trim()),await R(`/api/students/${encodeURIComponent(e)}/registration-pdf`,{headers:a})},async startProfileThumbnailBackfill(){await o("/api/students/backfill-profile-thumbnails",{method:"POST"})},async downloadRollSlipPdf(e,t,a){try{await this.downloadStudentRollSlipPdf(e,t);return}catch(r){console.warn("Server-side roll slip PDF fallback to client print:",r)}let i=a;if(!i||!i.fullName)try{i=await this.getStudentById(e)}catch{i={id:e,rollNumber:t}}H(i||{rollNumber:t})},async downloadStudentRollSlipPdf(e,t){if(!e)throw new Error("Student identifier is required to download roll number slip.");await P(`/api/students/${encodeURIComponent(e)}/roll-slip-pdf`,`AZM-RollSlip-${t||e}.pdf`)},async downloadStudentOmrPdf(e,t){if(!e)throw new Error("Student identifier is required to download OMR answer sheet.");await P(`/api/students/${encodeURIComponent(e)}/omr-sheet-pdf`,`AZM-OMR-${t||e}.pdf`)},async downloadBulkOmrPdf(e){if(!e?.length)throw new Error("At least one student must be selected.");await P("/api/students/bulk-omr-pdf",`AZM-Bulk-OMR-${e.length}-Candidates.pdf`,{method:"POST",body:{studentIds:e}})},async downloadBulkRollSlipsPdf(e){if(!e?.length)throw new Error("At least one student must be selected.");await P("/api/students/bulk-roll-slips-pdf",`AZM-Bulk-RollSlips-${e.length}-Candidates.pdf`,{method:"POST",body:{studentIds:e}})},async printStudentRollSlipPdf(e){if(!e)throw new Error("Student identifier is required to print roll number slip.");await R(`/api/students/${encodeURIComponent(e)}/roll-slip-pdf`,{title:"Printing Roll Number Slip…"})},async printStudentOmrPdf(e){if(!e)throw new Error("Student identifier is required to print OMR answer sheet.");await R(`/api/students/${encodeURIComponent(e)}/omr-sheet-pdf`,{title:"Printing MCQs OMR Sheet…"})},async downloadRegistrationSlipPdf(e){const t=e?.id||e?.applicationNo,a=e?.rollNumber;return this.downloadStudentPdf(t,a,e)},async downloadStudentsListPdf(e,t){const a=new URLSearchParams;e?.classLevel&&e.classLevel!=="ALL"&&a.append("classLevel",e.classLevel),e?.gender&&e.gender!=="ALL"&&a.append("gender",e.gender),e?.status&&e.status!=="ALL"&&a.append("status",e.status),e?.search&&e.search.trim()&&a.append("search",e.search.trim());const i=`AZM-Students-${new Date().toISOString().split("T")[0]}.pdf`;await P(`/api/students/export-pdf?${a.toString()}`,i)},async getPartners(e){const t=new URLSearchParams;e?.search&&t.set("search",e.search),e?.status&&e.status!=="ALL"&&t.set("status",e.status),e?.institutionType&&e.institutionType!=="ALL"&&t.set("institutionType",e.institutionType),e?.district&&e.district!=="ALL"&&e.district!=="all"&&t.set("district",e.district),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit)),e?.sortBy&&t.set("sortBy",e.sortBy),e?.sortOrder&&t.set("sortOrder",e.sortOrder);const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/partners${a}`);return i&&i.data&&Array.isArray(i.data)?{data:i.data,pagination:i.pagination||{page:1,limit:i.data.length,total:i.data.length,totalPages:1}}:Array.isArray(i)?{data:i,pagination:{page:1,limit:i.length,total:i.length,totalPages:1}}:{data:[],pagination:{page:1,limit:25,total:0,totalPages:1}}},async getPartnerById(e){const t=await o("/api/partners/"+e);return t?.data!==void 0?t.data:t},async getPartnerStatusHistory(e){const t=await o("/api/partners/"+e+"/status-history");return t&&Array.isArray(t.data)?t.data:Array.isArray(t)?t:[]},async registerPartner(e,t){const a={};return t&&(a["Idempotency-Key"]=t),o("/api/partners/register",{method:"POST",headers:a,body:JSON.stringify(e)})},async createPartner(e){const t=await o("/api/partners",{method:"POST",body:JSON.stringify(e)});return t?.data!==void 0?t.data:t},async updatePartnerProfile(e,t){const a=await o(`/api/partners/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data!==void 0?a.data:a},async updatePartnerStatus(e,t){return o(`/api/partners/${e}/status`,{method:"PATCH",body:JSON.stringify(t)})},async downloadPartnerPdf(e,t,a){const i={};a?.mobile&&(i["X-Partner-Mobile"]=a.mobile.trim()),a?.email&&(i["X-Partner-Email"]=a.email.trim()),await P(`/api/partners/${e}/registration-pdf`,`AZM_Partner_Acknowledgement_${t||e}.pdf`,{headers:i})},async scanAttendance(e){let t=(e.qrToken||e.studentId||e.rollNumber||"").trim();if(t.includes("http://")||t.includes("https://"))try{const a=new URL(t);t=a.searchParams.get("token")||a.searchParams.get("roll")||a.searchParams.get("rollNumber")||t.split("/").pop()||t}catch{}try{return await o("/api/attendance/scan",{method:"POST",body:JSON.stringify({...e,qrToken:t})})}catch(a){console.warn("Backend attendance scan fallback, looking up student locally:",a);const i=await this.getStudents(),r=t.toUpperCase(),l=t.replace(/\D/g,""),d=i.find(s=>{const p=s.rollNumber&&(s.rollNumber.toUpperCase()===r||r.includes(s.rollNumber.toUpperCase())),x=s.applicationNo&&(s.applicationNo.toUpperCase()===r||r.includes(s.applicationNo.toUpperCase())),n=s.id&&(s.id.toUpperCase()===r||r.includes(s.id.toUpperCase())),f=l.length>=5&&s.cnicOrBForm&&s.cnicOrBForm.replace(/\D/g,"")===l,m=s.qrToken&&(s.qrToken===t||t.includes(s.qrToken));return p||x||n||f||m});if(!d)throw new Error(`No registered student record found for QR code / identifier "${t}". Please verify that this candidate is registered.`);return{attendance:{id:`att_${Date.now()}`,studentId:d.id,studentName:d.fullName,rollNumber:d.rollNumber||"PENDING",currentClass:d.currentClass,date:new Date().toISOString().split("T")[0],status:e.status||"PRESENT",method:"QR_SCAN",markedByName:w?.name||"Chief Examiner",createdAt:new Date().toISOString()},student:d}}},async getTodayAttendance(){try{return await o("/api/attendance/today")}catch{return{totalActiveStudents:0,markedCount:0,attendancePercentage:0,records:[]}}},async getStudentAttendanceHistory(e){try{const t=await o(`/api/attendance/student/${e}`);return Array.isArray(t)?t:Array.isArray(t?.attendance)?t.attendance:[]}catch{return[]}},async getFees(e){try{const t=new URLSearchParams;e?.month&&e.month!=="ALL"&&t.append("month",e.month),e?.status&&e.status!=="ALL"&&t.append("status",e.status);const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/fees${a}`);return(Array.isArray(i)?i:Array.isArray(i?.feeRecords)?i.feeRecords:[]).map(l=>({id:l.id,challanNumber:l.challanNumber,studentId:l.studentId,studentName:l.student?.fullName||l.studentName||"Candidate",rollNumber:l.student?.rollNumber||l.rollNumber||"Pending Fee Approval",currentClass:l.student?.currentClass||l.currentClass||"SSC",month:l.month,amountDue:Number(l.amountDue)||300,amountPaid:Number(l.amountPaid)||0,status:l.status||"UNPAID",dueDate:l.dueDate?new Date(l.dueDate).toISOString().split("T")[0]:"2026-08-28",createdAt:l.createdAt}))}catch(t){return console.warn("Fees fetch error:",t),[]}},async generateChallans(e){return o("/api/fees/generate-challan",{method:"POST",body:JSON.stringify(e)})},async markFeePaid(e,t){return o(`/api/fees/${e}/mark-paid`,{method:"POST",body:JSON.stringify(t)})},async getStaffDirectory(e){const t=new URLSearchParams;e?.search?.trim()&&t.set("search",e.search.trim()),e?.role?.trim()&&t.set("role",e.role.trim()),e?.status&&t.set("status",e.status),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit));const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/staff${a}`),r=Array.isArray(i?.staff)?i.staff:Array.isArray(i?.data?.staff)?i.data.staff:Array.isArray(i?.data)?i.data:Array.isArray(i)?i:[],l=i?.pagination||i?.data?.pagination,d=r.map(s=>({id:s.id,fullName:s.fullName||"",role:s.role||"",cnic:s.cnic||"",phone:s.phone||"",status:s.status==="INACTIVE"?"INACTIVE":"ACTIVE",joinDate:s.joinDate?typeof s.joinDate=="string"?s.joinDate.split("T")[0]:String(s.joinDate):"",createdAt:s.createdAt||"",updatedAt:s.updatedAt||""})),u={page:Number(l?.page)||1,limit:Number(l?.limit)||e?.limit||20,total:Number(l?.total)||d.length,totalPages:Number(l?.totalPages)||(l?.total?Math.ceil(l.total/(Number(l?.limit)||20)):1)};return{staff:d,pagination:u}},async getStaffById(e){const t=await o(`/api/staff/${e}`),a=t?.data||t;return{id:a.id,fullName:a.fullName||"",role:a.role||"",cnic:a.cnic||"",phone:a.phone||"",joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"",salary:a.salary!=null?String(a.salary):"0",status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||"",payroll:Array.isArray(a.payroll)?a.payroll.map(i=>({id:i.id,staffId:i.staffId,month:i.month||"",amount:i.amount!=null?String(i.amount):"0",status:i.status==="PAID"?"PAID":"PENDING",paidAt:i.paidAt||null,createdAt:i.createdAt||"",updatedAt:i.updatedAt||""})):[]}},async createStaffMember(e){const t=await o("/api/staff",{method:"POST",body:JSON.stringify(e)}),a=t?.data||t;return{id:a.id,fullName:a.fullName||"",role:a.role||"",cnic:a.cnic||"",phone:a.phone||"",joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"",salary:a.salary!=null?String(a.salary):"0",status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||"",payroll:[]}},async updateStaffMember(e,t){const a=await o(`/api/staff/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{id:i.id,fullName:i.fullName||"",role:i.role||"",cnic:i.cnic||"",phone:i.phone||"",joinDate:i.joinDate?typeof i.joinDate=="string"?i.joinDate.split("T")[0]:String(i.joinDate):"",salary:i.salary!=null?String(i.salary):"0",status:i.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:i.createdAt||"",updatedAt:i.updatedAt||"",payroll:Array.isArray(i.payroll)?i.payroll.map(r=>({id:r.id,staffId:r.staffId,month:r.month||"",amount:r.amount!=null?String(r.amount):"0",status:r.status==="PAID"?"PAID":"PENDING",paidAt:r.paidAt||null,createdAt:r.createdAt||"",updatedAt:r.updatedAt||""})):[]}},async getStaff(){try{const e=await o("/api/staff");return(Array.isArray(e)?e:Array.isArray(e?.staff)?e.staff:[]).map(a=>({id:a.id,fullName:a.fullName,role:a.role,cnic:a.cnic,phone:a.phone,salary:Number(a.salary)||0,joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"2026-01-01",status:a.status||"ACTIVE"}))}catch(e){return console.warn("Staff fetch error:",e),[]}},async createStaff(e){return o("/api/staff",{method:"POST",body:JSON.stringify(e)})},async getPayroll(e){try{const t=e&&e!=="ALL"?`?month=${e}`:"",a=await o(`/api/payroll${t}`);return(Array.isArray(a)?a:Array.isArray(a?.payrollRecords)?a.payrollRecords:[]).map(r=>({id:r.id,staffId:r.staffId,staffName:r.staff?.fullName||r.staffName||"Staff Member",role:r.staff?.role||r.role||"Faculty",month:r.month,amount:Number(r.amount)||0,status:r.status||"PENDING",paidAt:r.paidAt,createdAt:r.createdAt}))}catch(t){return console.warn("Payroll fetch error:",t),[]}},async runPayroll(e){return o("/api/payroll/run",{method:"POST",body:JSON.stringify({month:e})})},async markPayrollPaid(e){return o(`/api/payroll/${e}/mark-paid`,{method:"POST"})},async getTransactions(e){const t=typeof e=="string"?{type:e}:e||{},a=new URLSearchParams;t.page&&a.set("page",String(t.page)),t.limit&&a.set("limit",String(t.limit)),t.type&&t.type!=="ALL"&&a.set("type",t.type),t.status&&t.status!=="ALL"&&a.set("status",t.status),t.source&&t.source!=="ALL"&&a.set("source",t.source),t.search&&t.search.trim()&&a.set("search",t.search.trim()),t.startDate&&t.startDate.trim()&&a.set("startDate",t.startDate.trim()),t.endDate&&t.endDate.trim()&&a.set("endDate",t.endDate.trim()),t.sortBy&&a.set("sortBy",t.sortBy),t.sortOrder&&a.set("sortOrder",t.sortOrder);const i=a.toString()?`?${a.toString()}`:"",r=await o(`/api/transactions${i}`),l=Array.isArray(r?.transactions)?r.transactions:Array.isArray(r?.data?.transactions)?r.data.transactions:Array.isArray(r?.data)?r.data:Array.isArray(r)?r:[],d=r?.pagination||r?.data?.pagination,u=l.map(s=>({id:s.id,type:s.type,amount:s.amount!=null?String(s.amount):"0.00",description:s.description||"",transactionDate:s.transactionDate||s.createdAt,status:s.status||"POSTED",source:s.source||"MANUAL",category:s.category??null,paymentMethod:s.paymentMethod??null,referenceNumber:s.referenceNumber??null,createdById:s.createdById??null,createdByName:s.createdByName??null,createdByEmail:s.createdByEmail??null,voidedAt:s.voidedAt??null,voidedById:s.voidedById??null,voidedByName:s.voidedByName??null,voidedByEmail:s.voidedByEmail??null,voidReason:s.voidReason??null,relatedFeeId:s.relatedFeeId??null,relatedPayrollId:s.relatedPayrollId??null,createdAt:s.createdAt,feeRecord:s.feeRecord??null,payrollRecord:s.payrollRecord??null}));return{transactions:u,pagination:{page:Number(d?.page)||t.page||1,limit:Number(d?.limit)||t.limit||20,total:typeof d?.total=="number"?d.total:u.length,totalPages:Number(d?.totalPages)||Math.ceil(u.length/(t.limit||20))||1}}},async getTransactionSummary(e){const t=new URLSearchParams;e?.type&&e.type!=="ALL"&&t.set("type",e.type),e?.source&&e.source!=="ALL"&&t.set("source",e.source),e?.startDate&&e.startDate.trim()&&t.set("startDate",e.startDate.trim()),e?.endDate&&e.endDate.trim()&&t.set("endDate",e.endDate.trim());const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/transactions/summary${a}`),r=i?.data!==void 0?i.data:i;return{currency:r?.currency||"PKR",totalIncome:r?.totalIncome!=null?String(r.totalIncome):"0.00",totalExpense:r?.totalExpense!=null?String(r.totalExpense):"0.00",netMovement:r?.netMovement!=null?String(r.netMovement):"0.00",postedCount:typeof r?.postedCount=="number"?r.postedCount:0,voidedCount:typeof r?.voidedCount=="number"?r.voidedCount:0,period:{startDate:r?.period?.startDate??e?.startDate??null,endDate:r?.period?.endDate??e?.endDate??null}}},async getTransactionById(e){const t=await o(`/api/transactions/${e}`),a=t?.data!==void 0?t.data:t;return{id:a.id,type:a.type,amount:a.amount!=null?String(a.amount):"0.00",description:a.description||"",transactionDate:a.transactionDate||a.createdAt,status:a.status||"POSTED",source:a.source||"MANUAL",category:a.category??null,paymentMethod:a.paymentMethod??null,referenceNumber:a.referenceNumber??null,createdById:a.createdById??null,createdByName:a.createdByName??null,createdByEmail:a.createdByEmail??null,voidedAt:a.voidedAt??null,voidedById:a.voidedById??null,voidedByName:a.voidedByName??null,voidedByEmail:a.voidedByEmail??null,voidReason:a.voidReason??null,relatedFeeId:a.relatedFeeId??null,relatedPayrollId:a.relatedPayrollId??null,createdAt:a.createdAt,feeRecord:a.feeRecord??null,payrollRecord:a.payrollRecord??null}},async createManualTransaction(e,t){const a={};t&&t.trim()&&(a["Idempotency-Key"]=t.trim());const i=await o("/api/transactions",{method:"POST",headers:a,body:JSON.stringify(e)}),r=i?.data!==void 0?i.data:i;return{id:r.id,type:r.type,amount:r.amount!=null?String(r.amount):"0.00",description:r.description||"",transactionDate:r.transactionDate||r.createdAt,status:r.status||"POSTED",source:r.source||"MANUAL",category:r.category??null,paymentMethod:r.paymentMethod??null,referenceNumber:r.referenceNumber??null,createdById:r.createdById??null,createdByName:r.createdByName??null,createdByEmail:r.createdByEmail??null,voidedAt:r.voidedAt??null,voidedById:r.voidedById??null,voidedByName:r.voidedByName??null,voidedByEmail:r.voidedByEmail??null,voidReason:r.voidReason??null,relatedFeeId:r.relatedFeeId??null,relatedPayrollId:r.relatedPayrollId??null,createdAt:r.createdAt,feeRecord:r.feeRecord??null,payrollRecord:r.payrollRecord??null}},async voidTransaction(e,t){const a=await o(`/api/transactions/${e}/void`,{method:"POST",body:JSON.stringify({reason:t.trim()})}),i=a?.data!==void 0?a.data:a;return{id:i.id,type:i.type,amount:i.amount!=null?String(i.amount):"0.00",description:i.description||"",transactionDate:i.transactionDate||i.createdAt,status:i.status||"VOIDED",source:i.source||"MANUAL",category:i.category??null,paymentMethod:i.paymentMethod??null,referenceNumber:i.referenceNumber??null,createdById:i.createdById??null,createdByName:i.createdByName??null,createdByEmail:i.createdByEmail??null,voidedAt:i.voidedAt??null,voidedById:i.voidedById??null,voidedByName:i.voidedByName??null,voidedByEmail:i.voidedByEmail??null,voidReason:i.voidReason??null,relatedFeeId:i.relatedFeeId??null,relatedPayrollId:i.relatedPayrollId??null,createdAt:i.createdAt,feeRecord:i.feeRecord??null,payrollRecord:i.payrollRecord??null}},async deleteTransaction(e){return await o(`/api/transactions/${e}`,{method:"DELETE"}),!0},async getUsers(e){return(await this.getUserDirectory(e)).users.map(a=>({id:a.id,name:a.name,email:a.email,role:a.role,status:a.status,createdAt:a.createdAt,updatedAt:a.updatedAt}))},async getUserDirectory(e){const t=new URLSearchParams;e?.search?.trim()&&t.set("search",e.search.trim()),e?.role&&e.role!=="ALL"&&t.set("role",e.role),e?.status&&e.status!=="ALL"&&t.set("status",e.status),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit));const a=t.toString()?`?${t.toString()}`:"",i=await o(`/api/users${a}`),r=i?.data??i,l=Array.isArray(r?.users)?r.users:Array.isArray(r?.items)?r.items:Array.isArray(r)?r:[],d=r?.pagination||i?.pagination,u=l.map(p=>({id:p.id,name:p.name||(p.email?p.email.split("@")[0]:""),email:p.email||"",role:p.role,status:p.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:p.createdAt||"",updatedAt:p.updatedAt||""})),s={page:Number(d?.page)||1,limit:Number(d?.limit)||e?.limit||20,total:Number(d?.total)||u.length,totalPages:Number(d?.totalPages)||(d?.total?Math.ceil(d.total/(Number(d?.limit)||20)):1)};return{users:u,pagination:s}},async getUserById(e){const t=await o(`/api/users/${e}`),a=t?.data??t;return{id:a.id,name:a.name||"",email:a.email||"",role:a.role,status:a.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:a.createdAt||"",updatedAt:a.updatedAt||""}},async createUser(e){const t=await o("/api/users",{method:"POST",body:JSON.stringify(e)}),a=t?.data||t;return{id:a.id||`usr_${Date.now()}`,name:a.name||e.name,email:a.email||e.email,role:a.role||e.role,status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString(),updatedAt:a.updatedAt||new Date().toISOString()}},async updateUserAccount(e,t){const a=await o(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{id:i.id||e,name:i.name||"",email:i.email||"",role:i.role,status:i.status==="INACTIVE"?"INACTIVE":"ACTIVE",createdAt:i.createdAt||"",updatedAt:i.updatedAt||new Date().toISOString()}},async updateUser(e,t){const a=await o(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(t)}),i=a?.data||a;return{id:i.id||e,name:i.name||"",email:i.email||"",role:i.role,status:i.status||"ACTIVE",createdAt:i.createdAt||new Date().toISOString()}},async deleteUser(e){return{success:!0,message:(await o(`/api/users/${e}`,{method:"DELETE"}))?.message||"User account deleted successfully"}},async getAnnouncements(){const e=await o("/api/announcements/admin");return{configured:e?.configured??!0,items:Array.isArray(e?.items)?e.items:[]}},async createAnnouncement(e){const t=await o("/api/announcements/admin",{method:"POST",body:JSON.stringify(e)});return t?.data||t},async updateAnnouncement(e,t){const a=await o(`/api/announcements/admin/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async deleteAnnouncement(e){const t=await o(`/api/announcements/admin/${e}`,{method:"DELETE"});return t?.data||t||{success:!0,id:e}},async getTestCenters(){const e=await o("/api/test-centers");return(Array.isArray(e)?e:Array.isArray(e?.data)?e.data:[]).map(a=>({id:a.id,name:a.name,code:a.code,campus:a.campus,address:a.address,district:a.district,province:a.province,capacity:Number(a.capacity)||300,reportingTime:a.reportingTime||"09:00 AM",testDate:a.testDate||"Sunday, 15 November 2026",contactPerson:a.contactPerson||"",contactPhone:a.contactPhone||"",status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString(),assignedCount:Number(a.assignedCount)||0}))},async createTestCenter(e){const t=await o("/api/test-centers",{method:"POST",body:JSON.stringify(e)});return t&&(t.data||t)||e},async updateTestCenter(e,t){const a=await o(`/api/test-centers/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a&&(a.data||a)||{id:e,...t}},async deleteTestCenter(e){return await o(`/api/test-centers/${e}`,{method:"DELETE"}),!0},async getStudentDocumentsPage(e=1,t=24,a){const i=new URLSearchParams({page:String(e),limit:String(t)});a&&i.set("studentId",a);const r=await o(`/api/students/documents?${i.toString()}`);if(Array.isArray(r?.documents)){const n={photo:"CANDIDATE_PHOTO",bform:"CNIC_BFORM",fatherCnic:"GUARDIAN_CNIC",dmc:"PREVIOUS_DMC",domicile:"DOMICILE",paymentReceipt:"PAYMENT_CHALLAN"},f=r.documents.map(m=>({id:m.id,studentId:m.studentId,studentName:m.studentName,rollNumber:m.rollNumber,applicationNo:m.applicationNo,currentClass:m.currentClass,docType:n[m.documentType]||"PREVIOUS_DMC",storageDocType:m.documentType,title:m.originalFileName||`${m.documentType} document`,fileUrl:"",fileEndpoint:m.fileEndpoint,fileSize:m.byteSize?`${Math.ceil(m.byteSize/1024)} KB`:"Stored attachment",fileType:m.mimeType,uploadedAt:m.uploadedAt,status:m.eligibility==="ELIGIBLE"?"VERIFIED":m.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",rejectionReason:m.eligibilityRemarks}));return{documents:f,pagination:r.pagination||{page:e,limit:t,total:f.length,totalPages:1}}}const l=await this.getStudents(),d=new Map;l.forEach(n=>{const f=a?a.toLowerCase().trim():"",m=a?a.replace(/\D/g,""):"";if(!(!a||n.id?.toLowerCase()===f||n.applicationNo?.toLowerCase()===f||n.rollNumber?.toLowerCase()===f||m.length>=5&&n.cnicOrBForm&&n.cnicOrBForm.replace(/\D/g,"")===m))return;let c=n.uploadedDocuments;if(typeof c=="string")try{c=JSON.parse(c)}catch{}if(!c&&n.uploadedDocsJson)try{c=JSON.parse(n.uploadedDocsJson)}catch{}c=c||{};const C=n.applicationNo||n.id,E=n.officeUse,T=E?.eligibility==="ELIGIBLE"?"VERIFIED":E?.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",D=E?.eligibilityRemarks,N=c.photo||c.photoUploaded||c.passportPhoto||c.candidatePhoto||c.profilePhoto;if(N||n.photoUrl){const A=N?.dataUrl?.startsWith("data:")||n.photoUrl?.startsWith("data:");d.set(`${C}_PHOTO`,{id:`doc_photo_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"CANDIDATE_PHOTO",storageDocType:"photo",title:N?.name||`${n.fullName}_Passport_Photo.jpg`,fileUrl:A?N?.dataUrl||n.photoUrl:"",fileEndpoint:`/api/students/${n.id}/document/photo`,fileSize:N?.size||(N?.byteSize?`${Math.ceil(N.byteSize/1024)} KB`:"Candidate Photo"),fileType:"image/jpeg",uploadedAt:N?.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}const g=c.bform||c.bformUploaded||c.cnic||c.candidateCnic;if(g){const A=g.name?.endsWith(".pdf")||g.mimeType==="application/pdf"||g.dataUrl?.includes("application/pdf");d.set(`${C}_BFORM`,{id:`doc_cnic_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"bform",title:g.name||`${n.fullName}_Candidate_BForm_CNIC.jpg`,fileUrl:g.dataUrl?.startsWith("data:")?g.dataUrl:"",fileEndpoint:`/api/students/${n.id}/document/bform`,fileSize:g.size||(g.byteSize?`${Math.ceil(g.byteSize/1024)} KB`:"Candidate Attachment"),fileType:A?"application/pdf":"image/jpeg",uploadedAt:g.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}const y=c.fatherCnic||c.fatherCnicUploaded||c.fcnic;if(y){const A=y.name?.endsWith(".pdf")||y.mimeType==="application/pdf"||y.dataUrl?.includes("application/pdf");d.set(`${C}_FATHER_CNIC`,{id:`doc_fcnic_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"fatherCnic",title:y.name||`${n.fullName}_Father_CNIC.jpg`,fileUrl:y.dataUrl?.startsWith("data:")?y.dataUrl:"",fileEndpoint:`/api/students/${n.id}/document/fatherCnic`,fileSize:y.size||(y.byteSize?`${Math.ceil(y.byteSize/1024)} KB`:"Candidate Attachment"),fileType:A?"application/pdf":"image/jpeg",uploadedAt:y.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}const h=c.dmc||c.dmcUploaded||c.resultCard||c.previousResult;if(h){const A=h.name?.endsWith(".pdf")||h.mimeType==="application/pdf"||h.dataUrl?.includes("application/pdf");d.set(`${C}_DMC`,{id:`doc_dmc_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"PREVIOUS_DMC",storageDocType:"dmc",title:h.name||`${n.fullName}_DMC_Marksheet.jpg`,fileUrl:h.dataUrl?.startsWith("data:")?h.dataUrl:"",fileEndpoint:`/api/students/${n.id}/document/dmc`,fileSize:h.size||(h.byteSize?`${Math.ceil(h.byteSize/1024)} KB`:"Candidate Attachment"),fileType:A?"application/pdf":"image/jpeg",uploadedAt:h.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}const b=c.paymentReceipt||c.incomeCertUploaded||c.receipt||c.challan;if(b){const A=b.name?.endsWith(".pdf")||b.mimeType==="application/pdf"||b.dataUrl?.includes("application/pdf");d.set(`${C}_FEE`,{id:`doc_pay_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"PAYMENT_CHALLAN",storageDocType:"paymentReceipt",title:b.name||`${n.fullName}_Fee_Payment_Receipt.jpg`,fileUrl:b.dataUrl?.startsWith("data:")?b.dataUrl:"",fileEndpoint:`/api/students/${n.id}/document/paymentReceipt`,fileSize:b.size||(b.byteSize?`${Math.ceil(b.byteSize/1024)} KB`:"Candidate Attachment"),fileType:A?"application/pdf":"image/jpeg",uploadedAt:b.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}const v=c.domicile||c.domicileUploaded;if(v){const A=v.name?.endsWith(".pdf")||v.mimeType==="application/pdf"||v.dataUrl?.includes("application/pdf");d.set(`${C}_DOMICILE`,{id:`doc_dom_${n.id}`,studentId:n.id,studentName:n.fullName,rollNumber:n.rollNumber||"PENDING",applicationNo:n.applicationNo||"APP-2026",currentClass:n.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"domicile",title:v.name||`${n.fullName}_Domicile_Certificate.jpg`,fileUrl:v.dataUrl?.startsWith("data:")?v.dataUrl:"",fileEndpoint:`/api/students/${n.id}/document/domicile`,fileSize:v.size||(v.byteSize?`${Math.ceil(v.byteSize/1024)} KB`:"Candidate Attachment"),fileType:A?"application/pdf":"image/jpeg",uploadedAt:v.uploadedAt||n.createdAt||new Date().toISOString(),status:T,rejectionReason:D})}});const u=Array.from(d.values()),s=u.length,p=Math.max(1,Math.ceil(s/t)),x=Math.min(Math.max(1,e),p);return{documents:u.slice((x-1)*t,x*t),pagination:{page:x,limit:t,total:s,totalPages:p}}},async getStudentDocuments(e){return(await this.getStudentDocumentsPage(1,50,e)).documents},async updateDocumentStatus(e,t,a,i){if(i)try{return await o(`/api/students/${i}/office-use`,{method:"PATCH",body:JSON.stringify({documentVerifiedBy:t==="VERIFIED"?"Admin Reviewer":void 0,documentVerifiedAt:t==="VERIFIED"?new Date().toISOString():void 0,eligibility:t==="VERIFIED"?"ELIGIBLE":t==="REJECTED"?"NOT_ELIGIBLE":void 0,eligibilityRemarks:a})}),!0}catch(r){return console.warn("Backend office-use document verification sync notice:",r),!1}return!0}};function Y(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your official registration slip.");return}const a=e.applicationNo||e.id||`APP-2026-${Math.floor(1e3+Math.random()*9e3)}`,i=e.createdAt?new Date(e.createdAt).toLocaleDateString():new Date().toLocaleDateString(),r=`
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
  `;t.document.open(),t.document.write(r),t.document.close()}function H(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your official Roll Number Slip.");return}const a=e.rollNumber||e.applicationNo||"AZMVS-2026-0000",i=e.testDate||"Sunday, 20 November 2026",r=e.reportingTime||"09:00 AM",l=e.assignedHall||"Hall A (Main Examination Wing)",d=e.assignedRoom||"Room 101",u=e.seatNo||"Seat # 01",s=e.testCenterName||e.registrationCentre||"AZM Regional Central Examination Centre, Mansehra",p=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Examination Entry Pass - Roll Slip ${a}</title>
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
          <div class="roll-highlight">${a}</div>
          <div class="meta-title" style="margin-top: 4px;">${e.fullName||"Candidate Name"}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">Father / Guardian: <strong>${e.fatherName||"Father Name"}</strong></div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">CNIC / B-Form: <strong style="font-family: monospace;">${e.cnicOrBForm||e.cnicBForm||"N/A"}</strong></div>
        </div>
      </div>
      <div style="text-align: center; flex-shrink: 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(a)}" alt="QR" style="width: 85px; height: 85px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" />
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">BIOMETRIC QR PASS</div>
      </div>
    </div>

    <div class="exam-box">
      <div class="exam-title">🎯 Examination Hall & Venue Assignment</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
        <div>📅 <strong>Exam Date:</strong> ${i}</div>
        <div>⏰ <strong>Reporting Time:</strong> ${r}</div>
        <div>🏛️ <strong>Exam Hall:</strong> ${l}</div>
        <div>🚪 <strong>Room & Seat:</strong> ${d} — ${u}</div>
        <div style="grid-column: 1 / -1; margin-top: 4px;">📍 <strong>Examination Centre:</strong> ${s}</div>
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
  `;t.document.open(),t.document.write(p),t.document.close()}function q(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your full student dossier.");return}const a=e.applicationNo||e.studentId||e.id||"APP-2026-0101",i=e.rollNumber||"AZMVS-2026-0101",r=e.createdAt?new Date(e.createdAt).toLocaleDateString():new Date().toLocaleDateString(),l=e.photoUrl?`<img src="${e.photoUrl}" alt="${e.fullName||"Candidate"} photo" style="width: 100%; height: 100%; object-fit: cover;" />`:'<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #64748b; font-size: 10px; font-weight: 800; text-align: center;">NO PHOTO<br/>AVAILABLE</div>',d=e.qrImageUrl||`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(i)}`,u=Array.isArray(e.academicRecords)?e.academicRecords:[],s=`
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
        ${u.length>0?u.map(p=>`
          <tr>
            <td><strong>${p.examLevel||"—"}</strong></td>
            <td>${p.yearOfPassing||p.year||"—"}</td>
            <td>${p.institute||p.boardOrUni||"—"}</td>
            <td>${p.boardOrUni||p.board||"—"}</td>
            <td>${p.totalMarks!=null?p.totalMarks:"—"}</td>
            <td><strong>${p.obtainedMarks!=null?p.obtainedMarks:"—"}</strong></td>
            <td><strong style="color: #15803d;">${p.percentage!=null?`${p.percentage}%`:"—"}</strong></td>
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
        <div>System Verified: ${r} | AZM.AIO Testing Service</div>
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
  `;t.document.open(),t.document.write(s),t.document.close()}export{ae as API_BASE_URL,X as DEFAULT_TEST_CENTERS,F as fetchRollNumberReleaseConfig,K as getCanonicalStudentKey,W as getRollNumberReleaseConfig,_ as isRollNumberReleased,Q as mockApi,H as printRollNumberSlip,q as printStudentDossier,Y as printStudentSlip,z as saveRollNumberReleaseConfig,Z as saveUploadedFilesForCandidate};
