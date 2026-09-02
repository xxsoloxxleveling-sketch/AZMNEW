# 🏅 AZM.AIO Educational Scholarship & Examination Portal

> **Official scholarship registration, computerized roll number slip generator, fee tracking, and on-site exam QR attendance management system for AZM.AIO (Pvt.) Ltd. (Session V 2026).**

---

## 📌 Project Overview
**AZMNEW** is a full-cycle educational scholarship administration portal designed for AZM.AIO. It manages candidate registration, fee challan generation, automated student roll number slip distribution with encoded QR codes, partner institution coordination, and on-site examination attendance verification via mobile and webcam QR code scanners.

---

## ✨ Key Features
- **📷 Real-Time Examination QR Attendance Hub:** Integrated webcam/camera QR scanner (`QrScannerTab.tsx`, `jsQR`) allowing test invigilators to scan student admit cards at exam center gates instantly.
- **🧾 Instant PDF Slip & Fee Challan Generator:** Automatic client-side PDF generation (`jsPDF`, `jspdf-autotable`) creating official roll number slips with QR codes and bank fee challans.
- **🌐 Interactive 3D Institutional Globe:** Dynamic interactive WebGL 3D globe visualization powered by `cobe` showcasing partner colleges and testing centers across regions.
- **💼 Comprehensive Admin Management Suite:** Real-time dashboard for auditing registrations, student records, fee reconciliation (`FeesListView.tsx`), and manual attendance overrides (`ManualAttendanceTab.tsx`).
- **🎉 Gamified Experience:** Celebratory interactive effects using `canvas-confetti` upon successful registration submission.

---

## 🛠️ Tech Stack
- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS, PostCSS
- **PDF & QR Engines:** `jspdf`, `jspdf-autotable`, `qrcode`, `jsqr`
- **3D Graphics & Animations:** `cobe`, `canvas-confetti`, Motion (`framer-motion`), Lucide React
- **Backend & AI:** Express.js, Google GenAI SDK (`@google/genai`)

---

## 📂 Project Structure
```text
src/
├── components/
│   ├── about/
│   │   └── AboutView.tsx                # Organization vision & scholarship criteria
│   ├── admin/
│   │   ├── attendance/
│   │   │   ├── AttendanceHubView.tsx    # Central attendance management hub
│   │   │   ├── ManualAttendanceTab.tsx  # Manual roll number entry & search
│   │   │   ├── QrScannerTab.tsx         # Live camera QR code barcode scanner
│   │   │   └── TeacherScanView.tsx      # Simplified invigilator mobile scanner view
│   │   ├── dashboard/
│   │   │   └── DashboardView.tsx        # Registration statistics & attendance KPIs
│   │   └── fees/
│   │       ├── FeesListView.tsx         # Fee payment status tracker
│   │       ├── GenerateChallanModal.tsx # Bank challan PDF creator
│   │       └── MarkFeePaidModal.tsx     # Payment verification modal
│   ├── common/
│   │   └── Header.tsx                   # Main portal navbar with role switcher
│   └── home/
│       └── HeroSection.tsx              # Scholarship call-to-action & timeline
├── lib/
│   └── authContext.tsx                  # Administrative authentication state
├── App.tsx                              # View controller & tab navigation router
└── main.tsx                             # Application initialization
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation
```bash
git clone git@github.com:xxsoloxxleveling-sketch/AZMNEW.git
cd AZMNEW
npm install
```

### Running Locally
```bash
npm run dev
```

---

## 👤 Author
- **xxsoloxxleveling** ([GitHub](https://github.com/xxsoloxxleveling-sketch))\n