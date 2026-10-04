# 🚀 Discord Online Controller - Deployment & Hosting Guide

> **বাংলা এবং ইংরেজি নির্দেশিকা (Bengali & English Guide)**

---

## ⚠️ Netlify কেন ব্যবহার করা যাবে না? (Why Netlify cannot be used)

- **Netlify** শুধুমাত্র **Static Website** এবং **Serverless Functions** (Lambda) চালানোর জন্য তৈরি।
- Serverless ফাংশন সর্বোচ্চ ১০-২৬ সেকেন্ড চলার পর বন্ধ হয়ে যায়।
- Discord 24/7 অনলাইন থাকার জন্য এবং Voice Channel-এ কানেক্ট থাকার জন্য সার্বক্ষণিক **Persistent WebSocket Connection** এবং **Node.js Process** চালু থাকা প্রয়োজন।
- তাই Netlify-তে ২৪/৭ ডিসকর্ড কন্ট্রোলার বা সেলফবট চালানো সম্ভব নয়।

---

## 🌐 সেরা ফ্রি এবং লো-রিসোর্স হোস্টিং অপশন (Best Free & Low-Spec Hosting)

এই প্রজেক্টটি বিশেষভাবে **খুব কম RAM (মাত্র ৩০-৫০ MB) এবং কম CPU** ব্যবহার করার জন্য অপ্টিমাইজ করা হয়েছে (`sweepers`, `silence keepalive`, এবং মেমরি ক্লিনআপ সহ)।

---

### অপশন ১: Render.com (১০০% ফ্রি + ২৪/৭ নো-স্লিপ) ⭐ সবচেয়ে সহজ

Render-এ ফ্রি অ্যাকাউন্ট দিয়ে এটি সরাসরি হোস্ট করতে পারবেন:

1. আপনার কোডটি একটি **GitHub Repository**-তে Push করুন।
2. [Render.com](https://render.com) এ লগইন করুন।
3. **New +** বাটনে ক্লিক করে **Web Service** সিলেক্ট করুন।
4. আপনার GitHub Repo কানেক্ট করুন।
5. নিচের সেটিংসগুলো দিন:
   - **Name:** `discord-controller`
   - **Environment:** `Node`
   - **Region:** Singapore / Frankfurt (আপনার নিকটবর্তী)
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
6. **Deploy Web Service** এ ক্লিক করুন।
7. ২-৩ মিনিটের মধ্যে আপনার নিজস্ব ওয়েবসাইট লিঙ্ক পেয়ে যাবেন (যেমন: `https://discord-controller-xxxx.onrender.com`)।

#### 🔴 Render যাতে ২৪/৭ সচল থাকে এবং স্লিপ (Sleep) না হয়:
Render-এর ফ্রি টিয়ার ১৫ মিনিট ইনঅ্যাক্টিভ থাকলে স্লিপে চলে যায়। এটি প্রতিরোধ করতে:
1. [UptimeRobot.com](https://uptimerobot.com) এ একটি ফ্রি অ্যাকাউন্ট খুলুন।
2. **Add New Monitor** এ ক্লিক করুন:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Discord Controller Ping`
   - **URL (or IP):** `https://your-render-url.onrender.com/ping`
   - **Monitoring Interval:** `5 minutes`
3. **Create Monitor** এ ক্লিক করুন।
4. ব্যস! UptimeRobot প্রতি ৫ মিনিট পর পর আপনার সার্ভারে পিং পাঠাবে, ফলে আপনার অ্যাপ কখনোই স্লিপে যাবে না এবং **২৪ ঘণ্টা ৭ দিন একটানা অনলাইন** থাকবে!

---

### অপশন ২: Koyeb (ফ্রি 512MB RAM - নো স্লিপ)

1. [Koyeb.com](https://www.koyeb.com)-এ ফ্রি সাইন আপ করুন।
2. **Create Service** > **GitHub** সিলেক্ট করুন।
3. আপনার Repo সিলেক্ট করুন।
4. Instance Size: **Free Nano (512MB RAM)** সিলেক্ট করুন।
5. Port: `3000` দিন এবং **Deploy** করুন।
6. Koyeb ফ্রি সার্ভিসগুলো কোনো স্লিপ ছাড়া ২৪/৭ চলে!

---

### অপশন ৩: আপনার নিজস্ব VPS বা লো-স্পেক লিনাক্স সার্ভার (Docker / PM2)

আপনার যদি একটি কম দামের VPS থাকে (যেমন ২৫৬MB বা ৫১২MB RAM):

#### মেথড A: Docker দিয়ে (সবচেয়ে পরিষ্কার ও অটো-রিস্টার্ট):
```bash
# প্রোজেক্ট ফোল্ডারে গিয়ে চালান:
docker compose up -d
```
এটি মেমরি ২৫৬MB এর মধ্যে সীমাবদ্ধ রেখে ব্যাকগ্রাউন্ডে ২৪/৭ চলবে।

#### মেথড B: PM2 দিয়ে:
```bash
npm install -g pm2
pm2 start server.js --name "discord-controller" --max-memory-restart 150M
pm2 save
pm2 startup
```

---

## 🔑 অটো-লগইন (Auto-Login on Server Restart)

যদি হোস্টিং সার্ভার কখনো রিস্টার্ট হয়, আর আপনি চান সার্ভার চালু হওয়ার সাথে সাথেই যেন আপনার ডিসকর্ড অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে অনলাইন হয়ে যায় এবং আগের Voice Channel-এ জয়েন করে:

Render বা Koyeb-এর **Environment Variables** এ গিয়ে যোগ করুন:
- `DISCORD_TOKEN` = `আপনার_ডিসকর্ড_টোকেন`

---

## 📱 কীভাবে ব্যবহার করবেন (Features)

1. **টোকেন লগইন:** আপনার ডিসকর্ড টোকেন দিয়ে লগইন করুন (Remember Token টিক চিহ্ন দিলে পরবর্তী সময়ে আর দিতে হবে না)।
2. **24/7 অনলাইন:** ব্রাউজার বা পিসি বন্ধ করে দিলেও ক্লাউড সার্ভার ডিসকর্ড সেশন ধরে রাখবে।
3. **Voice Control:** যেকোনো সার্ভার সিলেক্ট করে সরাসরি ভয়েস চ্যানেলে জয়েন করুন।
4. **Mute / Deafen:** এক ক্লিকে নিজেকে মিউট বা ডেফান করুন।
5. **Silence Keep-Alive:** ডিসকর্ড ভয়েস চ্যানেলে অনেকক্ষণ চুপ থাকলে যাতে ডিসকর্ড ডিসকানেক্ট না করে, তার জন্য সার্ভার স্বয়ংক্রিয়ভাবে সাইলেন্ট কিপ-অ্যালাইভ ফ্রেম পাঠায়।
6. **Screen Share (Static Image):** গো-লাইভ স্ক্রিন শেয়ার অন করলে এটি লোডিং স্ক্রিনে আটকে থাকবে না, লো-ব্যান্ডউইডথ ইমেজ স্ট্রিম প্রজেকশন বজায় রাখবে।
7. **লো-রিসোর্স অপ্টিমাইজেশন:** মেমরি লিকেজ রোধে ডিসকর্ড মেসেজ ও ইউজার ক্যাশ স্বয়ংক্রিয়ভাবে ক্লিন হয়।
