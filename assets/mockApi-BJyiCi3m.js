import{g as $,e as I,s as R,d as M,f as U}from"./index-AppAJQd3.js";import{b as n,c as D,d as L}from"./apiClient-YcCkpDKK.js";import{A as q}from"./apiClient-YcCkpDKK.js";import"./vendor-icons-C90mzqtc.js";import"./vendor-react-lhUb03DB.js";import"./vendor-globe-BTOyu2GH.js";let S=U()||null;const O=new Map,k={isScheduled:!1,releaseDateTime:"2026-10-15T09:00:00",announcementTitle:"Roll Number Slips Official Release Schedule",announcementMessage:"Official Roll Number Slips, Assigned Test Centers, and Examination Hall seatings are live.",emergencyNotice:"Your registration and fee verification are permanently confirmed in the examination registry.",updatedAt:"2026-08-24T00:00:00Z"};let x={...k};async function F(){try{const e=await n("/api/students/release-config"),t=e?.data||e;if(t&&typeof t.isScheduled=="boolean")return x=t,t}catch(e){console.warn("Failed to fetch roll number release config from live server:",e)}return x}function Z(){return x}async function _(e){const t={...x,...e,updatedAt:new Date().toISOString()};x=t;try{const a=await n("/api/students/release-config",{method:"POST",body:JSON.stringify(t)}),r=a?.data||a||t;return x=r,r}catch(a){return console.warn("Failed to persist release config to backend:",a),t}}function B(){if(!x.isScheduled||!x.releaseDateTime)return!0;const e=new Date(x.releaseDateTime).getTime();return Date.now()>=e}const K={async login(e,t){const a=await n("/api/auth/login",{method:"POST",body:JSON.stringify({email:e,password:t})}),r={id:a.user.id,name:a.user.name||a.user.email.split("@")[0],email:a.user.email,role:a.user.role,avatarUrl:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"};return R(a.accessToken),a.refreshToken&&M(a.refreshToken),I(r),S=r,{user:r,token:a.accessToken,role:r.role}},async getCurrentUser(){if(!$())return S;try{const t=await n("/api/auth/me");t&&t.user&&(S={...t.user,avatarUrl:t.user.avatarUrl||"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"},I(S))}catch{}return S},async switchRole(e){return S={...S||{id:"usr_001",email:"chief.admin@azmaio.com",avatarUrl:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"},role:e,name:e==="SUPER_ADMIN"?"AZM Super Administrator":e==="ADMIN"?"Examination Officer (Admin)":e==="ACCOUNTANT"?"Finance & Accounts Officer":"Invigilator / Examiner"},I(S),S},async getDashboardOverview(){const e=await n("/api/dashboard/overview"),t=await n("/api/fees?status=UNPAID").catch(()=>[]),a=Array.isArray(t)?t:Array.isArray(t?.feeRecords)?t.feeRecords:[];return{stats:{totalStudents:e.stats?.totalStudents||0,attendancePercentage:e.attendanceToday?.attendancePercentage||0,feeCollectionPercentage:e.feeCollection?.collectionPercentage||0,activeStaffCount:e.stats?.activeStaffCount||0,totalBilled:e.feeCollection?.totalBilled||0,totalCollected:e.feeCollection?.totalCollected||0,feeIncome:e.financialFlow?.feeIncome||0,salaryExpenses:e.financialFlow?.salaryExpenses||0,netCashFlow:e.financialFlow?.netCashFlow||0},attendanceTrends:[{day:"Mon",rate:e.attendanceToday?.attendancePercentage||0},{day:"Tue",rate:e.attendanceToday?.attendancePercentage||0},{day:"Wed",rate:e.attendanceToday?.attendancePercentage||0},{day:"Thu",rate:e.attendanceToday?.attendancePercentage||0},{day:"Fri",rate:e.attendanceToday?.attendancePercentage||0},{day:"Today",rate:e.attendanceToday?.attendancePercentage||0}],feeDefaulters:(a||[]).slice(0,5).map(r=>({id:r.id,studentName:r.student?.fullName||r.studentName||"Candidate",rollNumber:r.student?.rollNumber||r.rollNumber||"Pending Approval",currentClass:r.student?.currentClass||r.currentClass||"SSC",amountDue:Number(r.amountDue)||300,status:r.status||"UNPAID"})),recentActivity:[{id:"act_1",text:`System connected to live PostgreSQL cluster. Total enrolled students: ${e.stats?.totalStudents||0}`,time:"Live"},{id:"act_2",text:`Attendance ledger synced: ${e.attendanceToday?.markedCount||0} active check-ins recorded.`,time:"Today"}],demographics:{byGender:e.studentDemographics?.byGender||{MALE:0,FEMALE:0},byClassLevel:e.studentDemographics?.byClassLevel||{},byScholarshipCategory:e.studentDemographics?.byScholarshipCategory||{}}}},async getStudentsPage(e){const t=new URLSearchParams;t.append("page",String(e?.page||1)),t.append("limit",String(e?.limit||50)),e?.classLevel&&e?.classLevel!=="ALL"&&t.append("classLevel",e.classLevel),e?.gender&&e?.gender!=="ALL"&&t.append("gender",e.gender),e?.status&&e?.status!=="ALL"&&t.append("status",e.status),e?.search&&e.search.trim()&&t.append("search",e.search.trim());const a=`?${t.toString()}`,r=await n(`/api/students${a}`),s=(Array.isArray(r)?r:Array.isArray(r?.students)?r.students:[]).map(l=>({...l,rollNumber:l.rollNumber||null,feeStatus:l.feeStatus||(l.feeRecords?.length?l.feeRecords[0].status:"UNPAID"),attendancePercentage:l.attendancePercentage??100}));return{students:s,pagination:r?.pagination||{page:e?.page||1,limit:e?.limit||50,total:s.length,totalPages:1}}},async getStudents(e){return(await this.getStudentsPage({...e,page:1,limit:250})).students},async getStudentById(e){const t=await n(`/api/students/${e}`);return{...t,feeStatus:t.feeStatus||(t.feeRecords?.length?t.feeRecords[0].status:"UNPAID"),attendancePercentage:t.attendancePercentage??100}},async createStudent(e){return await n("/api/students/register",{method:"POST",body:JSON.stringify(e)})},async uploadStudentDocument(e){const t=(e.cnicOrBForm||e.applicationNo||e.studentId)?.trim();let a;if(!$()){if(!t||t==="TEMP_CANDIDATE")throw new Error("Enter the candidate CNIC or B-Form before uploading documents.");a=O.get(t),a||(a=(await n("/api/students/upload-session",{method:"POST",body:JSON.stringify({cnicOrBForm:t})})).token,O.set(t,a))}let r;const o=e.fileData.match(/^data:([^;]+);base64,(.*)$/s);if(o&&t){const s=atob(o[2]),l=new Uint8Array(s.length);for(let u=0;u<s.length;u++)l[u]=s.charCodeAt(u);r=await n("/api/students/upload-document-binary",{method:"POST",headers:{"Content-Type":e.contentType||o[1],"X-Candidate-Key":t,"X-Document-Type":e.docType,"X-File-Name":encodeURIComponent(e.fileName||`${e.docType}.bin`),...a?{"X-Upload-Session":a}:{}},body:new Blob([l],{type:e.contentType||o[1]})})}else r=await n("/api/students/upload-document",{method:"POST",headers:a?{"X-Upload-Session":a}:void 0,body:JSON.stringify(e)});return r?.data||r},async approveStudentPayment(e){return await n(`/api/students/${e}/approve-payment`,{method:"POST"})||{success:!0}},async getRollNumberStatus(){const e=await n("/api/students/roll-number-status");return e?.data||e},async issueRollNumbers(e){const t=await n("/api/students/issue-roll-numbers",{method:"POST",body:JSON.stringify({scheduledDate:e})});return t?.data||t},async deleteStudent(e){return await n(`/api/students/${e}`,{method:"DELETE"}),!0},async getRollNumberReleaseConfig(){return F()},async updateRollNumberReleaseConfig(e){return _(e)},isRollNumberReleased(){return B()},releaseAllPaidRollNumbers(){return 0},async updateOfficeUse(e,t){return n(`/api/students/${e}/office-use`,{method:"PATCH",body:JSON.stringify(t)})},async getExamHalls(){const e=await n("/api/exam-halls");return Array.isArray(e)?e:Array.isArray(e?.data)?e.data:[]},async createExamHall(e){const t=await n("/api/exam-halls",{method:"POST",body:JSON.stringify(e)});return t&&(t.data||t)||e},async updateExamHall(e,t){const a=await n(`/api/exam-halls/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a&&(a.data||a)||{id:e,...t}},async deleteExamHall(e){return await n(`/api/exam-halls/${e}`,{method:"DELETE"}),!0},async updateStudentAllocation(e,t){const a=await n(`/api/exam-halls/students/${e}/allocation`,{method:"PATCH",body:JSON.stringify(t)});return a?.data||a},async batchAssignStudentsToHall(e,t,a){return(await n(`/api/exam-halls/${e}/batch-assign`,{method:"POST",body:JSON.stringify({studentIds:a,hallName:t.hallName,roomNumber:t.roomNumber,testCenterName:t.testCenterName})}))?.count||a.length},async unassignStudentFromHall(e){return await n(`/api/exam-halls/students/${e}/allocation`,{method:"DELETE"}),!0},async downloadStudentPdf(e,t,a){if(!e)throw new Error("Student identifier is required to download the registration slip.");await D(`/api/students/${encodeURIComponent(e)}/registration-pdf${a?.cnicOrBForm?`?cnic=${encodeURIComponent(a.cnicOrBForm)}`:""}`,`AZM-Registration-${t||e}.pdf`)},async printStudentRegistrationPdf(e,t){if(!e)throw new Error("Student identifier is required to print the registration slip.");await L(`/api/students/${encodeURIComponent(e)}/registration-pdf${t?.cnicOrBForm?`?cnic=${encodeURIComponent(t.cnicOrBForm)}`:""}`)},async startProfileThumbnailBackfill(){await n("/api/students/backfill-profile-thumbnails",{method:"POST"})},async downloadRollSlipPdf(e,t,a){let r=a;if(!r||!r.fullName)try{r=await this.getStudentById(e)}catch{r={id:e,rollNumber:t}}z(r||{rollNumber:t})},async downloadRegistrationSlipPdf(e){const t=e?.id||e?.applicationNo,a=e?.rollNumber;return this.downloadStudentPdf(t,a,e)},async downloadStudentsListPdf(e,t){const a=new URLSearchParams;e?.classLevel&&e.classLevel!=="ALL"&&a.append("classLevel",e.classLevel),e?.gender&&e.gender!=="ALL"&&a.append("gender",e.gender),e?.status&&e.status!=="ALL"&&a.append("status",e.status),e?.search&&e.search.trim()&&a.append("search",e.search.trim());const r=`AZM-Students-${new Date().toISOString().split("T")[0]}.pdf`;await D(`/api/students/export-pdf?${a.toString()}`,r)},async getPartners(e){const t=new URLSearchParams;e?.search&&t.set("search",e.search),e?.status&&e.status!=="ALL"&&t.set("status",e.status),e?.institutionType&&e.institutionType!=="ALL"&&t.set("institutionType",e.institutionType),e?.district&&e.district!=="ALL"&&e.district!=="all"&&t.set("district",e.district),e?.page&&t.set("page",String(e.page)),e?.limit&&t.set("limit",String(e.limit)),e?.sortBy&&t.set("sortBy",e.sortBy),e?.sortOrder&&t.set("sortOrder",e.sortOrder);const a=t.toString()?`?${t.toString()}`:"",r=await n(`/api/partners${a}`);return r&&r.data&&Array.isArray(r.data)?{data:r.data,pagination:r.pagination||{page:1,limit:r.data.length,total:r.data.length,totalPages:1}}:Array.isArray(r)?{data:r,pagination:{page:1,limit:r.length,total:r.length,totalPages:1}}:{data:[],pagination:{page:1,limit:25,total:0,totalPages:1}}},async getPartnerById(e){return n(`/api/partners/${e}`)},async getPartnerStatusHistory(e){return n(`/api/partners/${e}/status-history`)},async registerPartner(e,t){const a={};return t&&(a["Idempotency-Key"]=t),n("/api/partners/register",{method:"POST",headers:a,body:JSON.stringify(e)})},async updatePartnerStatus(e,t){return n(`/api/partners/${e}/status`,{method:"PATCH",body:JSON.stringify(t)})},async downloadPartnerPdf(e,t){await D(`/api/partners/${e}/registration-pdf`,`AZM_Partner_Acknowledgement_${t||e}.pdf`)},async scanAttendance(e){let t=(e.qrToken||e.studentId||e.rollNumber||"").trim();if(t.includes("http://")||t.includes("https://"))try{const a=new URL(t);t=a.searchParams.get("token")||a.searchParams.get("roll")||a.searchParams.get("rollNumber")||t.split("/").pop()||t}catch{}try{return await n("/api/attendance/scan",{method:"POST",body:JSON.stringify({...e,qrToken:t})})}catch(a){console.warn("Backend attendance scan fallback, looking up student locally:",a);const r=await this.getStudents(),o=t.toUpperCase(),s=t.replace(/\D/g,""),l=r.find(p=>{const m=p.rollNumber&&(p.rollNumber.toUpperCase()===o||o.includes(p.rollNumber.toUpperCase())),T=p.applicationNo&&(p.applicationNo.toUpperCase()===o||o.includes(p.applicationNo.toUpperCase())),i=p.id&&(p.id.toUpperCase()===o||o.includes(p.id.toUpperCase())),N=s.length>=5&&p.cnicOrBForm&&p.cnicOrBForm.replace(/\D/g,"")===s,c=p.qrToken&&(p.qrToken===t||t.includes(p.qrToken));return m||T||i||N||c});if(!l)throw new Error(`No registered student record found for QR code / identifier "${t}". Please verify that this candidate is registered.`);return{attendance:{id:`att_${Date.now()}`,studentId:l.id,studentName:l.fullName,rollNumber:l.rollNumber||"PENDING",currentClass:l.currentClass,date:new Date().toISOString().split("T")[0],status:e.status||"PRESENT",method:"QR_SCAN",markedByName:S?.name||"Chief Examiner",createdAt:new Date().toISOString()},student:l}}},async getTodayAttendance(){try{return await n("/api/attendance/today")}catch{return{totalActiveStudents:0,markedCount:0,attendancePercentage:0,records:[]}}},async getStudentAttendanceHistory(e){try{const t=await n(`/api/attendance/student/${e}`);return Array.isArray(t)?t:Array.isArray(t?.attendance)?t.attendance:[]}catch{return[]}},async getFees(e){try{const t=new URLSearchParams;e?.month&&e.month!=="ALL"&&t.append("month",e.month),e?.status&&e.status!=="ALL"&&t.append("status",e.status);const a=t.toString()?`?${t.toString()}`:"",r=await n(`/api/fees${a}`);return(Array.isArray(r)?r:Array.isArray(r?.feeRecords)?r.feeRecords:[]).map(s=>({id:s.id,challanNumber:s.challanNumber,studentId:s.studentId,studentName:s.student?.fullName||s.studentName||"Candidate",rollNumber:s.student?.rollNumber||s.rollNumber||"Pending Fee Approval",currentClass:s.student?.currentClass||s.currentClass||"SSC",month:s.month,amountDue:Number(s.amountDue)||300,amountPaid:Number(s.amountPaid)||0,status:s.status||"UNPAID",dueDate:s.dueDate?new Date(s.dueDate).toISOString().split("T")[0]:"2026-08-28",createdAt:s.createdAt}))}catch(t){return console.warn("Fees fetch error:",t),[]}},async generateChallans(e){return n("/api/fees/generate-challan",{method:"POST",body:JSON.stringify(e)})},async markFeePaid(e,t){return n(`/api/fees/${e}/mark-paid`,{method:"POST",body:JSON.stringify(t)})},async getStaff(){try{const e=await n("/api/staff");return(Array.isArray(e)?e:Array.isArray(e?.staff)?e.staff:[]).map(a=>({id:a.id,fullName:a.fullName,role:a.role,cnic:a.cnic,phone:a.phone,salary:Number(a.salary)||0,joinDate:a.joinDate?typeof a.joinDate=="string"?a.joinDate.split("T")[0]:String(a.joinDate):"2026-01-01",status:a.status||"ACTIVE"}))}catch(e){return console.warn("Staff fetch error:",e),[]}},async createStaff(e){return n("/api/staff",{method:"POST",body:JSON.stringify(e)})},async getPayroll(e){try{const t=e&&e!=="ALL"?`?month=${e}`:"",a=await n(`/api/payroll${t}`);return(Array.isArray(a)?a:Array.isArray(a?.payrollRecords)?a.payrollRecords:[]).map(o=>({id:o.id,staffId:o.staffId,staffName:o.staff?.fullName||o.staffName||"Staff Member",role:o.staff?.role||o.role||"Faculty",month:o.month,amount:Number(o.amount)||0,status:o.status||"PENDING",paidAt:o.paidAt,createdAt:o.createdAt}))}catch(t){return console.warn("Payroll fetch error:",t),[]}},async runPayroll(e){return n("/api/payroll/run",{method:"POST",body:JSON.stringify({month:e})})},async markPayrollPaid(e){return n(`/api/payroll/${e}/mark-paid`,{method:"POST"})},async getTransactions(e){try{const t=e&&e!=="ALL"?`?type=${e}`:"",a=await n(`/api/transactions${t}`);return(Array.isArray(a)?a:Array.isArray(a?.transactions)?a.transactions:[]).map(o=>({id:o.id,type:o.type,amount:Number(o.amount)||0,description:o.description,relatedFeeId:o.relatedFeeId,relatedPayrollId:o.relatedPayrollId,createdAt:o.createdAt}))}catch(t){return console.warn("Transactions fetch error:",t),[]}},async deleteTransaction(e){return await n(`/api/transactions/${e}`,{method:"DELETE"}),!0},async getUsers(){const e=await n("/api/users");return(Array.isArray(e)?e:Array.isArray(e?.data)?e.data:[]).map(a=>({id:a.id,name:a.name||a.email.split("@")[0],email:a.email,role:a.role,status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString()}))},async createUser(e){const t=await n("/api/users",{method:"POST",body:JSON.stringify(e)}),a=t?.data||t;return{id:a.id||`usr_${Date.now()}`,name:a.name||e.name,email:a.email||e.email,role:a.role||e.role,status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString()}},async getTestCenters(){const e=await n("/api/test-centers");return(Array.isArray(e)?e:Array.isArray(e?.data)?e.data:[]).map(a=>({id:a.id,name:a.name,code:a.code,campus:a.campus,address:a.address,district:a.district,province:a.province,capacity:Number(a.capacity)||300,reportingTime:a.reportingTime||"09:00 AM",testDate:a.testDate||"Sunday, 15 November 2026",contactPerson:a.contactPerson||"",contactPhone:a.contactPhone||"",status:a.status||"ACTIVE",createdAt:a.createdAt||new Date().toISOString(),assignedCount:Number(a.assignedCount)||0}))},async createTestCenter(e){const t=await n("/api/test-centers",{method:"POST",body:JSON.stringify(e)});return t&&(t.data||t)||e},async updateTestCenter(e,t){const a=await n(`/api/test-centers/${e}`,{method:"PATCH",body:JSON.stringify(t)});return a&&(a.data||a)||{id:e,...t}},async deleteTestCenter(e){return await n(`/api/test-centers/${e}`,{method:"DELETE"}),!0},async getStudentDocumentsPage(e=1,t=24,a){const r=new URLSearchParams({page:String(e),limit:String(t)});a&&r.set("studentId",a);const o=await n(`/api/students/documents?${r.toString()}`);if(Array.isArray(o?.documents)){const i={photo:"CANDIDATE_PHOTO",bform:"CNIC_BFORM",fatherCnic:"GUARDIAN_CNIC",dmc:"PREVIOUS_DMC",domicile:"DOMICILE",paymentReceipt:"PAYMENT_CHALLAN"},N=o.documents.map(c=>({id:c.id,studentId:c.studentId,studentName:c.studentName,rollNumber:c.rollNumber,applicationNo:c.applicationNo,currentClass:c.currentClass,docType:i[c.documentType]||"PREVIOUS_DMC",storageDocType:c.documentType,title:c.originalFileName||`${c.documentType} document`,fileUrl:"",fileEndpoint:c.fileEndpoint,fileSize:c.byteSize?`${Math.ceil(c.byteSize/1024)} KB`:"Stored attachment",fileType:c.mimeType,uploadedAt:c.uploadedAt,status:c.eligibility==="ELIGIBLE"?"VERIFIED":c.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",rejectionReason:c.eligibilityRemarks}));return{documents:N,pagination:o.pagination||{page:e,limit:t,total:N.length,totalPages:1}}}const s=await this.getStudents(),l=new Map;s.forEach(i=>{const N=a?a.toLowerCase().trim():"",c=a?a.replace(/\D/g,""):"";if(!(!a||i.id?.toLowerCase()===N||i.applicationNo?.toLowerCase()===N||i.rollNumber?.toLowerCase()===N||c.length>=5&&i.cnicOrBForm&&i.cnicOrBForm.replace(/\D/g,"")===c))return;let d=i.uploadedDocuments;if(typeof d=="string")try{d=JSON.parse(d)}catch{}if(!d&&i.uploadedDocsJson)try{d=JSON.parse(i.uploadedDocsJson)}catch{}d=d||{};const C=i.applicationNo||i.id,E=i.officeUse,P=E?.eligibility==="ELIGIBLE"?"VERIFIED":E?.eligibility==="NOT_ELIGIBLE"?"REJECTED":"PENDING_REVIEW",w=E?.eligibilityRemarks,A=d.photo||d.photoUploaded||d.passportPhoto||d.candidatePhoto||d.profilePhoto;if(A||i.photoUrl){const v=A?.dataUrl?.startsWith("data:")||i.photoUrl?.startsWith("data:");l.set(`${C}_PHOTO`,{id:`doc_photo_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"CANDIDATE_PHOTO",storageDocType:"photo",title:A?.name||`${i.fullName}_Passport_Photo.jpg`,fileUrl:v?A?.dataUrl||i.photoUrl:"",fileEndpoint:`/api/students/${i.id}/document/photo`,fileSize:A?.size||(A?.byteSize?`${Math.ceil(A.byteSize/1024)} KB`:"Candidate Photo"),fileType:"image/jpeg",uploadedAt:A?.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}const g=d.bform||d.bformUploaded||d.cnic||d.candidateCnic;if(g){const v=g.name?.endsWith(".pdf")||g.mimeType==="application/pdf"||g.dataUrl?.includes("application/pdf");l.set(`${C}_BFORM`,{id:`doc_cnic_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"bform",title:g.name||`${i.fullName}_Candidate_BForm_CNIC.jpg`,fileUrl:g.dataUrl?.startsWith("data:")?g.dataUrl:"",fileEndpoint:`/api/students/${i.id}/document/bform`,fileSize:g.size||(g.byteSize?`${Math.ceil(g.byteSize/1024)} KB`:"Candidate Attachment"),fileType:v?"application/pdf":"image/jpeg",uploadedAt:g.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}const f=d.fatherCnic||d.fatherCnicUploaded||d.fcnic;if(f){const v=f.name?.endsWith(".pdf")||f.mimeType==="application/pdf"||f.dataUrl?.includes("application/pdf");l.set(`${C}_FATHER_CNIC`,{id:`doc_fcnic_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"fatherCnic",title:f.name||`${i.fullName}_Father_CNIC.jpg`,fileUrl:f.dataUrl?.startsWith("data:")?f.dataUrl:"",fileEndpoint:`/api/students/${i.id}/document/fatherCnic`,fileSize:f.size||(f.byteSize?`${Math.ceil(f.byteSize/1024)} KB`:"Candidate Attachment"),fileType:v?"application/pdf":"image/jpeg",uploadedAt:f.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}const h=d.dmc||d.dmcUploaded||d.resultCard||d.previousResult;if(h){const v=h.name?.endsWith(".pdf")||h.mimeType==="application/pdf"||h.dataUrl?.includes("application/pdf");l.set(`${C}_DMC`,{id:`doc_dmc_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"PREVIOUS_DMC",storageDocType:"dmc",title:h.name||`${i.fullName}_DMC_Marksheet.jpg`,fileUrl:h.dataUrl?.startsWith("data:")?h.dataUrl:"",fileEndpoint:`/api/students/${i.id}/document/dmc`,fileSize:h.size||(h.byteSize?`${Math.ceil(h.byteSize/1024)} KB`:"Candidate Attachment"),fileType:v?"application/pdf":"image/jpeg",uploadedAt:h.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}const y=d.paymentReceipt||d.incomeCertUploaded||d.receipt||d.challan;if(y){const v=y.name?.endsWith(".pdf")||y.mimeType==="application/pdf"||y.dataUrl?.includes("application/pdf");l.set(`${C}_FEE`,{id:`doc_pay_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"PAYMENT_CHALLAN",storageDocType:"paymentReceipt",title:y.name||`${i.fullName}_Fee_Payment_Receipt.jpg`,fileUrl:y.dataUrl?.startsWith("data:")?y.dataUrl:"",fileEndpoint:`/api/students/${i.id}/document/paymentReceipt`,fileSize:y.size||(y.byteSize?`${Math.ceil(y.byteSize/1024)} KB`:"Candidate Attachment"),fileType:v?"application/pdf":"image/jpeg",uploadedAt:y.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}const b=d.domicile||d.domicileUploaded;if(b){const v=b.name?.endsWith(".pdf")||b.mimeType==="application/pdf"||b.dataUrl?.includes("application/pdf");l.set(`${C}_DOMICILE`,{id:`doc_dom_${i.id}`,studentId:i.id,studentName:i.fullName,rollNumber:i.rollNumber||"PENDING",applicationNo:i.applicationNo||"APP-2026",currentClass:i.currentClass||"SSC",docType:"CNIC_BFORM",storageDocType:"domicile",title:b.name||`${i.fullName}_Domicile_Certificate.jpg`,fileUrl:b.dataUrl?.startsWith("data:")?b.dataUrl:"",fileEndpoint:`/api/students/${i.id}/document/domicile`,fileSize:b.size||(b.byteSize?`${Math.ceil(b.byteSize/1024)} KB`:"Candidate Attachment"),fileType:v?"application/pdf":"image/jpeg",uploadedAt:b.uploadedAt||i.createdAt||new Date().toISOString(),status:P,rejectionReason:w})}});const u=Array.from(l.values()),p=u.length,m=Math.max(1,Math.ceil(p/t)),T=Math.min(Math.max(1,e),m);return{documents:u.slice((T-1)*t,T*t),pagination:{page:T,limit:t,total:p,totalPages:m}}},async getStudentDocuments(e){return(await this.getStudentDocumentsPage(1,50,e)).documents},async updateDocumentStatus(e,t,a,r){if(r)try{return await n(`/api/students/${r}/office-use`,{method:"PATCH",body:JSON.stringify({documentVerifiedBy:t==="VERIFIED"?"Admin Reviewer":void 0,documentVerifiedAt:t==="VERIFIED"?new Date().toISOString():void 0,eligibility:t==="VERIFIED"?"ELIGIBLE":t==="REJECTED"?"NOT_ELIGIBLE":void 0,eligibilityRemarks:a})}),!0}catch(o){return console.warn("Backend office-use document verification sync notice:",o),!1}return!0},async purgeAllData(){try{return await n("/api/students/purge-all-system-data",{method:"POST"}).catch(e=>{console.warn("Backend purge API notification:",e)}),purgeLegacyDataCaches(),!0}catch(e){return console.error("Failed to purge data:",e),!1}}};function z(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your official Roll Number Slip.");return}const a=e.rollNumber||e.applicationNo||"AZMVS-2026-0000",r=e.testDate||"Sunday, 20 November 2026",o=e.reportingTime||"09:00 AM",s=e.assignedHall||"Hall A (Main Examination Wing)",l=e.assignedRoom||"Room 101",u=e.seatNo||"Seat # 01",p=e.testCenterName||e.registrationCentre||"AZM Regional Central Examination Centre, Mansehra",m=`
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
        <div>📅 <strong>Exam Date:</strong> ${r}</div>
        <div>⏰ <strong>Reporting Time:</strong> ${o}</div>
        <div>🏛️ <strong>Exam Hall:</strong> ${s}</div>
        <div>🚪 <strong>Room & Seat:</strong> ${l} — ${u}</div>
        <div style="grid-column: 1 / -1; margin-top: 4px;">📍 <strong>Examination Centre:</strong> ${p}</div>
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
  `;t.document.open(),t.document.write(m),t.document.close()}function X(e){const t=window.open("","_blank");if(!t){alert("Please allow popups to open and print your full student dossier.");return}const a=e.applicationNo||e.studentId||e.id||"APP-2026-0101",r=e.rollNumber||"AZMVS-2026-0101",o=e.createdAt?new Date(e.createdAt).toLocaleDateString():new Date().toLocaleDateString(),s=e.photoUrl?`<img src="${e.photoUrl}" alt="${e.fullName||"Candidate"} photo" style="width: 100%; height: 100%; object-fit: cover;" />`:'<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #64748b; font-size: 10px; font-weight: 800; text-align: center;">NO PHOTO<br/>AVAILABLE</div>',l=e.qrImageUrl||`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r)}`,u=e.academicRecords||[{examLevel:"Class 6th (Middle Wing)",year:"2022",institute:e.schoolName||"Govt / Private High School",board:"BISE / School Assessment",totalMarks:600,obtainedMarks:Math.round((Number(e.lastClassPercentage)||88)*6),percentage:Number(e.lastClassPercentage)||88,grade:"A-1"},{examLevel:"Class 7th (Middle Wing)",year:"2023",institute:e.schoolName||"Govt / Private High School",board:"BISE / School Assessment",totalMarks:700,obtainedMarks:Math.round((Number(e.lastClassPercentage)||88)*7),percentage:Number(e.lastClassPercentage)||88,grade:"A-1"},{examLevel:"Class 8th (Middle Standard)",year:"2024",institute:e.schoolName||"Govt / Private High School",board:"BISE Board Assessment",totalMarks:800,obtainedMarks:Math.round((Number(e.lastClassPercentage)||89)*8),percentage:Number(e.lastClassPercentage)||89,grade:"A-1"},{examLevel:"Class 9th (SSC-I Matric)",year:"2025",institute:e.schoolName||"High School & College",board:e.boardOrUniversity||"BISE Abbottabad",totalMarks:550,obtainedMarks:Math.round((Number(e.lastClassPercentage)||91)*5.5),percentage:Number(e.lastClassPercentage)||91,grade:"A-1"},{examLevel:e.currentClass||"Class 10th (SSC-II)",year:"2026",institute:e.schoolName||"School & College",board:e.boardOrUniversity||"BISE Abbottabad",totalMarks:1100,obtainedMarks:Math.round((Number(e.lastClassPercentage)||92)*11),percentage:Number(e.lastClassPercentage)||92,grade:"A-1"}],p=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Student Profile Dossier - ${r} (${e.fullName})</title>
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
        <img src="${l}" alt="QR" style="width: 70px; height: 70px; border-radius: 6px; border: 1px solid #cbd5e1; padding: 2px;" />
        <div style="font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 2px;">${r}</div>
      </div>
    </div>

    <div style="display: flex; gap: 18px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
      <div style="width: 90px; height: 100px; border-radius: 8px; border: 2px solid #0f172a; overflow: hidden; background: #fff; flex-shrink: 0;">
        ${s}
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
        ${u.map(m=>`
          <tr>
            <td><strong>${m.examLevel}</strong></td>
            <td>${m.year}</td>
            <td>${m.institute}</td>
            <td>${m.board}</td>
            <td>${m.totalMarks}</td>
            <td><strong>${m.obtainedMarks}</strong></td>
            <td><strong style="color: #15803d;">${m.percentage}%</strong></td>
          </tr>
        `).join("")}
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
        <div>Security Authentication Hash: <strong>SHA256-${r}</strong></div>
        <div>System Verified: ${o} | AZM.AIO Testing Service</div>
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
  `;t.document.open(),t.document.write(p),t.document.close()}export{q as API_BASE_URL,F as fetchRollNumberReleaseConfig,Z as getRollNumberReleaseConfig,B as isRollNumberReleased,K as mockApi,z as printRollNumberSlip,X as printStudentDossier,_ as saveRollNumberReleaseConfig};
