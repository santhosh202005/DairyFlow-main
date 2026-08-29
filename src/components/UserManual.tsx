import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Factory,
  FileText,
  HelpCircle,
  PiggyBank,
  Printer,
  ShieldCheck,
  Users,
  UserRound,
  Wallet,
  Milk,
  Package,
  Layers
} from 'lucide-react';

interface UserManualProps {
  userRole?: string;
}

const customerLanguageContent = {
  en: {
    title: 'DairyFlow Customer Manual',
    subtitle: 'Farmer & Customer Guide for milk tracking, advances, feed, and billing',
    printBtn: 'Print / Save PDF',
    login: 'Login',
    dashboard: 'Dashboard',
    daily: 'Daily records',
    balance: 'Balance check',
    faqLabel: 'Frequently Asked Questions',
    tipsLabel: 'Important Tips for Dairy Farmers',
    printNote: 'Use the browser print option and choose Save as PDF to download a printable copy.',
    intro:
      'Welcome to your DairyFlow Farmer Portal! Easily monitor your daily milk supply, verify applied rates, track advance cash and cattle feed deductions, and view your billing statements anytime.',
    quickSteps: [
      { title: '1. Log In', text: 'Sign in with your registered phone number or customer ID and password to access your portal.' },
      { title: '2. Daily Milk Records', text: 'Check your morning and evening milk entries, measured liters, FAT/SNF, and applied rate per liter.' },
      { title: '3. Track Advances & Feed', text: 'Monitor received cash advances and cattle feed bag purchases deducted from your payout.' },
      { title: '4. Review Ledger & Bills', text: 'View gross milk earnings, itemized deductions, and your current net balance payable.' },
    ],
    featuresTitle: 'Your Portal Key Features',
    features: [
      { title: 'Dashboard', description: 'Instant overview of today’s milk collection, current period balance, and recent activities.', icon: FileText },
      { title: 'My Supply', description: 'Full day-by-day logs of morning and evening milk deliveries with exact liters and rates.', icon: Milk },
      { title: 'My Ledger', description: 'Transparent records of cash advances and payments received from the dairy.', icon: Wallet },
      { title: 'My Stocks', description: 'Itemized details of cattle feed bags purchased and deducted from your account.', icon: Package },
    ],
    sections: [
      {
        heading: '1. Checking Daily Milk Deliveries',
        items: [
          'Go to the "My Supply" section from the sidebar or bottom menu.',
          'Review the morning and evening sessions for liters supplied and rate applied.',
          'Use the date range and monthly filters to view previous delivery records.',
          'Verify your entries regularly to ensure accuracy with your dairy collection center.',
        ],
      },
      {
        heading: '2. Understanding Advances & Cattle Feed',
        items: [
          'Open "My Ledger" to view any cash advances given to you by the dairy.',
          'Open "My Stocks" to track cattle feed bags issued to you along with the prices.',
          'All advances and cattle feed costs are transparently deducted from your milk earnings.',
          'Check the date and amount on every transaction for peace of mind.',
        ],
      },
      {
        heading: '3. Calculating Your Payout & Bill',
        items: [
          'Gross Milk Earnings = Total Milk Liters × Rate per Liter.',
          'Total Deductions = Cash Advances Taken + Cattle Feed Costs.',
          'Net Balance Payable = Gross Milk Earnings - Total Deductions.',
          'Check the Dashboard to see your up-to-date net balance at any time.',
        ],
      },
      {
        heading: '4. Saving and Printing Statements',
        items: [
          'Click the "Print / Save PDF" button at the top right of this guide or reports.',
          'In the print dialog, select "Save as PDF" as your destination printer.',
          'Store the downloaded PDF on your mobile phone or print a physical copy.',
        ],
      },
    ],
    tips: [
      { title: 'Check entries daily', text: 'Verify your morning and evening milk quantities on the same day they are entered.' },
      { title: 'Track feed and advances', text: 'Keep tabs on cattle feed purchases and cash advances so your final billing is clear.' },
      { title: 'Report discrepancies early', text: 'If you notice any difference in quantity or rate, notify your dairy vendor promptly.' },
      { title: 'Save monthly PDF bills', text: 'Download and save periodic billing statements for your personal financial records.' },
    ],
    faq: [
      { q: 'How do I know my daily milk price and rate?', a: 'Your daily rate per liter is recorded with each milk entry in the "My Supply" table and summarized on your dashboard.' },
      { q: 'Where do I see my remaining balance and earnings?', a: 'The Dashboard displays your total milk earnings, advances taken, feed deductions, and net balance payable.' },
      { q: 'How are cattle feed and cash advances deducted?', a: 'They are automatically subtracted from your gross milk total in your billing statement.' },
      { q: 'Can I use DairyFlow on my mobile phone?', a: 'Yes! DairyFlow is fully mobile-friendly and can be accessed from any smartphone browser or installed as an app.' },
    ],
  },
  ta: {
    title: 'டெய்ரி ஃப்ளோ வாடிக்கையாளர் கையேடு',
    subtitle: 'பால் உற்பத்தியாளர்கள் & வாடிக்கையாளர்களுக்கான பயனர் வழிகாட்டி',
    printBtn: 'அச்சிடு / PDF சேமி',
    login: 'உள்நுழைவு',
    dashboard: 'டாஷ்போர்டு',
    daily: 'நாளாந்தி பதிவுகள்',
    balance: 'இருப்பு சரிபார்ப்பு',
    faqLabel: 'அடிக்கடி கேட்கப்படும் கேள்விகள் (FAQ)',
    tipsLabel: 'விவசாயிகளுக்கான முக்கிய குறிப்புகள்',
    printNote: 'பிரவுசர் அச்சிடு விருப்பத்தை பயன்படுத்தி Save as PDF தேர்ந்தெடுத்து PDF ஆக சேமிக்கலாம்.',
    intro:
      'டெய்ரி ஃப்ளோ வாடிக்கையாளர் தளத்திற்கு வரவேற்கிறோம்! உங்கள் தினசரி பால் விநியோகம், விலை, பெற்ற முன்வைப்பு தொகைகள், மாட்டுத் தீவன கழிவுகள் மற்றும் பில்களை எளிதாக அறிந்து கொள்ளுங்கள்.',
    quickSteps: [
      { title: '1. உள்நுழையுங்கள்', text: 'உங்கள் தொலைபேசி எண் மற்றும் கடவுச்சொல்லைப் பயன்படுத்தி வாடிக்கையாளர் தளத்தில் நுழையுங்கள்.' },
      { title: '2. தினசரி பால் பதிவுகள்', text: 'காலை மற்றும் மாலை பால் அளவு (லிட்டர்), கொழுப்பு அளவு மற்றும் நிர்ணயிக்கப்பட்ட விலையை சரிபார்க்கவும்.' },
      { title: '3. முன்வைப்பு & தீவனம்', text: 'நீங்கள் பெற்ற முன்வைப்பு ரொக்கம் மற்றும் வாங்கிய மாட்டுத் தீவன விவரங்களை அறிந்து கொள்ளுங்கள்.' },
      { title: '4. பில் மற்றும் கணக்கு', text: 'உங்கள் மொத்த பால் வருமானம், கழிவுகள் மற்றும் நிகர நிலுவை தொகையை சரிபார்க்கவும்.' },
    ],
    featuresTitle: 'வாடிக்கையாளர் முக்கிய அம்சங்கள்',
    features: [
      { title: 'முகப்பு (Dashboard)', description: 'இன்றைய பால் விநியோகம், சமீபத்திய முன்வைப்புகள் மற்றும் தற்போதைய நிலுவை சுருக்கம்.', icon: FileText },
      { title: 'எனது விநியோகம் (My Supply)', description: 'காலை மற்றும் மாலை பால் அளவு, விலை விவரங்களின் முழுமையான தினசரி பதிவு.', icon: Milk },
      { title: 'எனது கணக்கு (My Ledger)', description: 'ரொக்க முன்வைப்புகள் மற்றும் பெறப்பட்ட கொடுப்பனவுகளின் வெளிப்படையான விவரம்.', icon: Wallet },
      { title: 'எனது தீவனம் (My Stocks)', description: 'உங்கள் பில்லில் கழிக்கப்பட்ட மாட்டுத் தீவன கொள்முதல் விவரங்கள்.', icon: Package },
    ],
    sections: [
      {
        heading: '1. தினசரி பால் பதிவுகளை சரிபார்ப்பது',
        items: [
          'மெனுவிலிருந்து "எனது விநியோகம்" (My Supply) பகுதியை திறக்கவும்.',
          'காலை மற்றும் மாலை அமர்வுகளில் பதிவான லிட்டர் மற்றும் விலையை சரிபார்க்கவும்.',
          'தேதி வடிகட்டியை பயன்படுத்தி முந்தைய மாதங்களின் பதிவுகளையும் பார்வையிடலாம்.',
          'பதிவுகள் சரியாக உள்ளதா என்பதை அன்றே உறுதிப்படுத்திக் கொள்ளுங்கள்.',
        ],
      },
      {
        heading: '2. முன்வைப்பு & தீவன கழிவுகளை அறிவது',
        items: [
          '"எனது கணக்கு" (My Ledger) பிரிவில் நீங்கள் பெற்ற ரொக்க முன்வைப்பு விவரங்களை பாருங்கள்.',
          '"எனது தீவனம்" (My Stocks) பிரிவில் வாங்கிய மாட்டுத் தீவன பைகளின் கட்டணத்தை அறியலாம்.',
          'முன்வைப்புகள் மற்றும் தீவன செலவுகள் உங்கள் மொத்த பால் தொகையிலிருந்து கழிக்கப்படும்.',
          'ஒவ்வொரு பரிவர்த்தனையின் தேதி மற்றும் தொகையை எளிதாக சரிபார்க்கலாம்.',
        ],
      },
      {
        heading: '3. பில் மற்றும் நிலுவை தொகையை கணக்கிடுதல்',
        items: [
          'மொத்த பால் தொகை = மொத்த லிட்டர் × லிட்டர் விலை.',
          'மொத்த கழிவுகள் = ரொக்க முன்வைப்பு + மாட்டுத் தீவன செலவு.',
          'நிகர நிலுவை = மொத்த பால் தொகை - மொத்த கழிவுகள்.',
          'முகப்பு டாஷ்போர்டில் உங்கள் தற்போதைய நிலுவை தொகையை எப்போது வேண்டுமானாலும் பார்க்கலாம்.',
        ],
      },
      {
        heading: '4. அறிக்கைகளை சேமிப்பது மற்றும் அச்சிடுவது',
        items: [
          'மேலே உள்ள "அச்சிடு / PDF சேமி" பொத்தானை கிளிக் செய்து அச்சிடலாம்.',
          'உங்கள் மொபைல் அல்லது கணினியில் "Save as PDF" தேர்ந்தெடுத்து PDF ஆக சேமிக்கலாம்.',
          'டிஜிட்டல் நகலை உங்கள் தொலைபேசியில் வைத்து உங்கள் கணக்கை எளிதாக பராமரிக்கலாம்.',
        ],
      },
    ],
    tips: [
      { title: 'பதிவுகளை தினமும் சரிபார்க்கவும்', text: 'காலை மற்றும் மாலை பால் அளவை அன்றே பார்த்து உறுதிப்படுத்தவும்.' },
      { title: 'முன்வைப்புகளை கண்காணிக்கவும்', text: 'பில் செட்டில்மென்ட்டின் போது குழப்பம் வராமல் முன்வைப்புகள் மற்றும் தீவனத்தை கவனியுங்கள்.' },
      { title: 'பிழைகள் இருப்பின் உடனே கூறவும்', text: 'பால் அளவு அல்லது விலையில் மாற்றம் இருந்தால் உடனடியாக உங்கள் டெய்ரி உரிமையாளரிடம் தெரிவிக்கவும்.' },
      { title: 'மாதாந்திர PDF பில்களை சேமிக்கவும்', text: 'உங்கள் சொந்த கணக்கு பதிவிற்காக அவ்வப்போது பில் அறிக்கைகளை PDF ஆக சேமித்துக் கொள்ளுங்கள்.' },
    ],
    faq: [
      { q: 'எனது பால் விலை மற்றும் மொத்த தொகையை எவ்வாறு பார்ப்பது?', a: '"எனது விநியோகம்" அல்லது முகப்பு பக்கத்தில் லிட்டர் விலை மற்றும் மொத்த தொகையை நேரடியாக பார்க்கலாம்.' },
      { q: 'மாட்டுத் தீவனம் மற்றும் முன்வைப்புகள் எவ்வாறு கழிக்கப்படும்?', a: 'உங்கள் மொத்த பால் தொகையிலிருந்து முன்வைப்புகள் மற்றும் தீவன தொகைகள் தானாக கழிக்கப்பட்டு நிகர தொகை கணக்கிடப்படும்.' },
      { q: 'முந்தைய மாத பில்களை எவ்வாறு பார்ப்பது?', a: 'தேதி வடிகட்டியில் விரும்பிய மாதத்தை தேர்ந்தெடுத்து முந்தைய அறிக்கைகளை எளிதாக பார்க்கலாம்.' },
      { q: 'மொபைல் போனில் டெய்ரி ஃப்ளோ செயலியை பயன்படுத்த முடியுமா?', a: 'ஆம்! டெய்ரி ஃப்ளோ மொபைல் பிரவுசர்களிலும் மற்றும் ஆண்ட்ராய்டு ஆப் ஆகவும் சிறப்பாக செயல்படும்.' },
    ],
  },
};

const generalLanguageContent = {
  en: {
    title: 'DairyFlow User Manual',
    subtitle: 'Printable guide for customers, vendors, and staff',
    printBtn: 'Print / Save PDF',
    customer: 'Customer',
    vendor: 'Vendor',
    all: 'All users',
    login: 'Login',
    dashboard: 'Dashboard',
    daily: 'Daily records',
    balance: 'Balance check',
    faqLabel: 'Quick FAQ',
    tipsLabel: 'Important business tips',
    printNote: 'Use the browser print option and choose Save as PDF to download a printable copy.',
    intro:
      'This app helps manage dairy business operations such as milk entries, customer billing, vendor payments, worker attendance, advances, and reports.',
    quickSteps: [
      { title: '1. Log in', text: 'Use your username and password to sign in. Admin, vendor, customer, and worker roles appear separately.' },
      { title: '2. Open the dashboard', text: 'The dashboard shows your summary, balances, and recent activity.' },
      { title: '3. Record daily activity', text: 'Use milk entries, payment entries, advances, and feed records for daily updates.' },
      { title: '4. Review balance', text: 'Check dues, advances, and payment status before the next transaction.' },
    ],
    roles: [
      { title: 'Admin', description: 'Manage vendors, customers, and business settings from one place.' },
      { title: 'Vendor', description: 'Add workers, record milk supply, track advances, and manage salaries.' },
      { title: 'Customer', description: 'Check milk records, view bills, review payments, and track due amounts.' },
      { title: 'Worker', description: 'View work, check attendance, and review salary reports.' },
    ],
    sections: [
      {
        heading: 'Customer step-by-step',
        items: [
          'Open the app and log in using your customer account.',
          'Go to the dashboard to view today’s milk supply and recent balance.',
          'Open the ledger or billing section to check due amount and payment status.',
          'Pay the outstanding amount and confirm the payment is saved in the system.',
        ],
      },
      {
        heading: 'Vendor step-by-step',
        items: [
          'Log in with your vendor account and open the vendor dashboard.',
          'Add or select the customer and record the daily milk quantity and rate.',
          'Add advances, deductions, or payment entries if needed.',
          'Review worker salary and final reports before closing the day.',
        ],
      },
      {
        heading: 'Admin step-by-step',
        items: [
          'Open the admin dashboard and check vendor and customer activity.',
          'Review all recent entries, balances, and account changes.',
          'Manage settings and user access for correct operation.',
          'Keep the system accurate by reviewing daily records and payment updates.',
        ],
      },
    ],
    tips: [
      { title: 'Keep entries updated daily', text: 'Daily updates reduce errors and keep balances accurate.' },
      { title: 'Check pending balances often', text: 'Review dues before creating new bills or payments.' },
      { title: 'Use the correct role', text: 'The correct login role shows the correct data and menus.' },
      { title: 'Protect account settings', text: 'Update credentials and profile information carefully and securely.' },
    ],
    faq: [
      { q: 'What is the main purpose of this app?', a: 'It helps track milk supply, bills, customer and vendor payments, worker salary, and balances.' },
      { q: 'Can I check my account balance?', a: 'Yes. Use the dashboard and ledger sections to view the current balance and payment history.' },
      { q: 'How do I keep records accurate?', a: 'Enter data daily, verify quantity and rate, and regularly review reports.' },
    ],
  },
  ta: {
    title: 'டெய்ரி ஃப்ளோ பயனர் கையேடு',
    subtitle: 'வாடிக்கையாளர், விற்பனையாளர் மற்றும் பணியாளர்களுக்கான அச்சு வழிகாட்டி',
    printBtn: 'அச்சிடு / PDF சேமி',
    customer: 'வாடிக்கையாளர்',
    vendor: 'விற்பனையாளர்',
    all: 'அனைத்து பயனர்களும்',
    login: 'உள்நுழைவு',
    dashboard: 'டாஷ்போர்டு',
    daily: 'நாளாந்தி பதிவுகள்',
    balance: 'இருப்பு சரிபார்ப்பு',
    faqLabel: 'விரைவு கேள்விகள்',
    tipsLabel: 'முக்கிய வணிக குறிப்புகள்',
    printNote: 'பிரவுசர் அச்சிடு விருப்பத்தை பயன்படுத்தி Save as PDF தேர்ந்தெடுத்து PDF ஆக சேமிக்கலாம்.',
    intro:
      'இந்த செயலி பால்நிலை வணிகத்தை நிர்வகிக்க உதவுகிறது: பால் பதிவுகள், பில் கணக்கு, விற்பனையாளர்/வாடிக்கையாளர் கொடுப்பனவுகள், பணியாளர் வருகை, முன்னேறிய தொகை மற்றும் அறிக்கைகள்.',
    quickSteps: [
      { title: '1. உள்நுழையுங்கள்', text: 'உங்கள் பயனர் பெயர் மற்றும் கடவுச்சொல்லை பயன்படுத்தி உள்நுழையுங்கள். நிர்வாகி, விற்பனையாளர், வாடிக்கையாளர் மற்றும் பணியாளர் பதிப்புகள் தனித்தனியாக உள்ளன.' },
      { title: '2. டாஷ்போர்டை திறக்கவும்', text: 'டாஷ்போர்டு சுருக்கம், நிலுவை மற்றும் சமீபத்திய செயல்பாடுகளை காட்டும்.' },
      { title: '3. தினசரி பதிவுகளை சேர்க்கவும்', text: 'பால் பதிவு, கட்டணம், முன்வைப்புகள், தீவனம் போன்ற தரவை தினமும் புதுப்பிக்கவும்.' },
      { title: '4. இருப்பை சரிபார்க்கவும்', text: 'அடுத்த பரிவர்த்தனைக்கு முன் நிலுவை, முன்வைப்புகள் மற்றும் செலுத்துதல் நிலையைப் பாருங்கள்.' },
    ],
    roles: [
      { title: 'நிர்வாகி', description: 'விற்பனையாளர்கள், வாடிக்கையாளர்கள் மற்றும் அமைப்புகளை ஒரு இடத்தில் நிர்வகிக்கவும்.' },
      { title: 'விற்பனையாளர்', description: 'பணியாளர்களை சேர்த்து பால் விநியோகத்தை பதிவு செய்து, முன்வைப்புகள் மற்றும் சம்பளங்களை நிர்வகிக்கவும்.' },
      { title: 'வாடிக்கையாளர்', description: 'பால் பதிவுகள், பில்கள், பணம் செலுத்தல் மற்றும் நிலுவை தொகையை பார்க்கலாம்.' },
      { title: 'பணியாளர்', description: 'பணி, வருகை மற்றும் சம்பள அறிக்கைகளை பார்க்கலாம்.' },
    ],
    sections: [
      {
        heading: 'வாடிக்கையாளர் படிப்படியான செயல்முறை',
        items: [
          'ஆப் திறந்து உங்கள் வாடிக்கையாளர் கணக்குடன் உள்நுழையவும்.',
          'டாஷ்போர்டை திறந்து இன்று பால் அளவு மற்றும் இருப்பை பார்க்கவும்.',
          'லெட்ஜர் அல்லது பில் பிரிவை திறந்து நிலுவை தொகை மற்றும் செலுத்திய நிலையை சரிபார்க்கவும்.',
          'நிலுவை தொகையை செலுத்தி, பதிவு சேமிக்கப்பட்டிருப்பதை உறுதிப்படுத்தவும்.',
        ],
      },
      {
        heading: 'விற்பனையாளர் படிப்படியான செயல்முறை',
        items: [
          'விற்பனையாளர் கணக்குடன் உள்நுழையவும்.',
          'வாடிக்கையாளரை தேர்ந்தெடுத்து தினசரி பால் அளவு மற்றும் விலை பதிவை செய்யவும்.',
          'தேவைக்கேற்ப முன்வைப்புகள், கழிப்புகள் மற்றும் பணம் செலுத்துதல் பதிவுகளை சேர்க்கவும்.',
          'நாள் முடிவில் பணியாளர் சம்பளம் மற்றும் அறிக்கைகளை பார்வையிடவும்.',
        ],
      },
      {
        heading: 'நிர்வாகி படிப்படியான செயல்முறை',
        items: [
          'நிர்வாகி டாஷ்போர்டை திறந்து விற்பனையாளர் மற்றும் வாடிக்கையாளர் செயல்பாடுகளை பாருங்கள்.',
          'சமீபத்திய பதிவுகள், இருப்பு மற்றும் மாற்றங்களை மதிப்பாய்வு செய்யவும்.',
          'அமைப்புகள் மற்றும் பயனர் அணுகலை சரியாக பராமரிக்கவும்.',
          'தினசரி பதிவுகள் மற்றும் பணம் செலுத்துதல் புதுப்பிப்புகளை தொடர்ந்து பரிசோதிக்கவும்.',
        ],
      },
    ],
    tips: [
      { title: 'பதிவுகளை தினமும் புதுப்பிக்கவும்', text: 'தினசரி பதிவுகள் பிழைகளை குறைத்து இருப்பை துல்லியமாக்கும்.' },
      { title: 'நிலுவை இருப்பை அடிக்கடி சரிபார்க்கவும்', text: 'புதிய பில் அல்லது கட்டணத்திற்கு முன் நிலுவை தொகையை பாருங்கள்.' },
      { title: 'சரியான பாத்திரத்தை பயன்படுத்தவும்', text: 'சரியான உள்நுழைவு பாத்திரம் சரியான தகவல்களை காட்டும்.' },
      { title: 'கணக்கு அமைப்புகளை பாதுகாக்கவும்', text: 'கடவுச்சொல் மற்றும் சுயவிவர தகவல்களை கவனமாக புதுப்பிக்கவும்.' },
    ],
    faq: [
      { q: 'இந்த செயலியின் முக்கிய நோக்கம் என்ன?', a: 'பால் விநியோகம், பில், வாடிக்கையாளர் மற்றும் விற்பனையாளர் கொடுப்பனவுகள், பணியாளர் சம்பளம் மற்றும் இருப்பைப் பின்பற்றுவதே இதன் நோக்கம்.' },
      { q: 'எனது இருப்பை நான் எப்படி பார்க்கலாம்?', a: 'டாஷ்போர்டு மற்றும் லெட்ஜர் பிரிவுகளில் தற்போதைய இருப்பையும் பணப்பரிவர்த்தனை வரலாற்றையும் பார்க்கலாம்.' },
      { q: 'பதிவுகளை எவ்வாறு துல்லியமாக வைத்திருப்பது?', a: 'தினமும் தரவை உள்ளிடுங்கள், அளவு மற்றும் விலையை சரிபார்த்து, அறிக்கைகளை தவறாமல் மதிப்பாய்வு செய்யுங்கள்.' },
    ],
  },
};

export default function UserManual({ userRole }: UserManualProps) {
  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const isCustomer = userRole === 'customer';

  const [audience, setAudience] = useState<'all' | 'customer' | 'vendor'>(
    userRole === 'vendor' ? 'vendor' : 'all'
  );

  // If customer site / customer role, render dedicated Customer Manual
  if (isCustomer) {
    const content = customerLanguageContent[language];

    return (
      <div className="space-y-8 pb-20 print:pb-0">
        {/* Banner */}
        <section className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 md:p-8 text-white shadow-lg shadow-emerald-100 print:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 p-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
                  {language === 'en' ? 'Farmer Guide' : 'விவசாயி வழிகாட்டி'}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">{content.title}</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-emerald-700 px-4 py-2 font-semibold shadow-sm hover:bg-emerald-50 transition"
              >
                <Printer className="h-4 w-4" /> {content.printBtn}
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  language === 'en' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('ta')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  language === 'ta' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                தமிழ்
              </button>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-emerald-50/90 text-base md:text-lg leading-relaxed">
            {content.intro}
          </p>
          <p className="mt-3 text-sm text-emerald-50/80 print:block hidden">{content.printNote}</p>
        </section>

        {/* Quick Steps */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.quickSteps.map(({ title, text }, index) => {
            const Icon = [UserRound, Milk, Wallet, CheckCircle2][index % 4];
            return (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid hover:border-emerald-200 transition-colors"
              >
                <div className="mb-4 inline-flex rounded-xl bg-emerald-50 p-3 text-emerald-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
              </div>
            );
          })}
        </section>

        {/* Customer Key Portal Features */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm print:shadow-none">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="h-6 w-6 text-emerald-600" />
            <h3 className="text-2xl font-bold text-slate-900">{content.featuresTitle}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.features.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl bg-slate-50 p-5 border border-slate-200 print:break-inside-avoid"
              >
                <div className="mb-4 inline-flex rounded-xl bg-white p-3 text-emerald-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Step-by-Step Sections */}
        <section className="grid gap-4 lg:grid-cols-2">
          {content.sections.map(({ heading, items }) => (
            <div
              key={heading}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span>
                {heading}
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                {items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Tips for Farmers */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm print:shadow-none">
          <div className="flex items-center gap-3 mb-6">
            <CircleDollarSign className="h-6 w-6 text-emerald-600" />
            <h3 className="text-2xl font-bold text-slate-900">{content.tipsLabel}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {content.tips.map(({ title, text }, index) => {
              const palette = [
                'bg-emerald-50 border-emerald-100',
                'bg-amber-50 border-amber-100',
                'bg-sky-50 border-sky-100',
                'bg-violet-50 border-violet-100',
              ];
              return (
                <div
                  key={title}
                  className={`rounded-2xl p-5 border ${palette[index % palette.length]} print:break-inside-avoid`}
                >
                  <h4 className="font-bold text-slate-900 mb-2">{title}</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 md:p-8 text-white shadow-md print:shadow-none">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="h-6 w-6 text-emerald-300" />
            <h3 className="text-2xl font-bold">{content.faqLabel}</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2 text-sm text-slate-200">
            {content.faq.map(({ q, a }) => (
              <div key={q} className="rounded-2xl bg-white/5 p-4 border border-white/10">
                <p className="font-semibold text-emerald-300 mb-1.5">Q: {q}</p>
                <p className="text-slate-300 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Print Note */}
        <section className="hidden print:block rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{content.title}</span>
            <span>{content.printNote}</span>
          </div>
        </section>
      </div>
    );
  }

  // General Manual (for Admin, Vendor, Staff)
  const content = generalLanguageContent[language];

  const visibleSections =
    audience === 'all'
      ? content.sections
      : content.sections.filter((section) =>
          section.heading.toLowerCase().includes(audience)
        );

  return (
    <div className="space-y-8 pb-20 print:pb-0">
      <section className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 md:p-8 text-white shadow-lg shadow-emerald-100 print:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
                {language === 'en' ? 'User Guide' : 'பயனர் வழிகாட்டி'}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">{content.title}</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-emerald-700 px-4 py-2 font-semibold shadow-sm hover:bg-emerald-50 transition"
            >
              <Printer className="h-4 w-4" /> {content.printBtn}
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                language === 'en' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('ta')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                language === 'ta' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-emerald-50/90 text-base md:text-lg leading-relaxed">
          {content.intro}
        </p>
        <p className="mt-3 text-sm text-emerald-50/80 print:block hidden">{content.printNote}</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 md:p-5 shadow-sm print:shadow-none">
        <div className="flex flex-wrap gap-2 print:hidden">
          {[
            { key: 'all', label: content.all },
            { key: 'customer', label: content.customer },
            { key: 'vendor', label: content.vendor },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAudience(tab.key as 'all' | 'customer' | 'vendor')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                audience === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {content.quickSteps.map(({ title, text }, index) => {
          const Icon = [UserRound, FileText, CheckCircle2, Wallet][index % 4];
          return (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid"
            >
              <div className="mb-4 inline-flex rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm print:shadow-none">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="h-6 w-6 text-emerald-600" />
          <h3 className="text-2xl font-bold text-slate-900">
            {language === 'en' ? 'Who uses the app?' : 'இந்த செயலியை யார் பயன்படுத்துகிறார்கள்?'}
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.roles.map(({ title, description }, index) => {
            const Icon = [ShieldCheck, Factory, Users, PiggyBank][index % 4];
            return (
              <div
                key={title}
                className="rounded-2xl bg-slate-50 p-5 border border-slate-200 print:break-inside-avoid"
              >
                <div className="mb-4 inline-flex rounded-xl bg-white p-3 text-emerald-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {visibleSections.map(({ heading, items }) => (
          <div
            key={heading}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">{heading}</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              {items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm print:shadow-none">
        <div className="flex items-center gap-3 mb-6">
          <CircleDollarSign className="h-6 w-6 text-emerald-600" />
          <h3 className="text-2xl font-bold text-slate-900">{content.tipsLabel}</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {content.tips.map(({ title, text }, index) => {
            const palette = [
              'bg-emerald-50 border-emerald-100',
              'bg-amber-50 border-amber-100',
              'bg-sky-50 border-sky-100',
              'bg-violet-50 border-violet-100',
            ];
            return (
              <div
                key={title}
                className={`rounded-2xl p-5 border ${palette[index % palette.length]} print:break-inside-avoid`}
              >
                <h4 className="font-bold text-slate-900 mb-2">{title}</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 md:p-8 text-white shadow-md print:shadow-none">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="h-6 w-6 text-emerald-300" />
          <h3 className="text-2xl font-bold">{content.faqLabel}</h3>
        </div>

        <div className="space-y-5 text-sm text-slate-200">
          {content.faq.map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-white">Q: {q}</p>
              <p className="mt-1">A: {a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hidden print:block rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>{content.title}</span>
          <span>{content.printNote}</span>
        </div>
      </section>
    </div>
  );
}

