import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getMessages } from "@/lib/i18n/server";

import { Bullets, Contact, LegalPage, Section } from "../legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.privacy, description: t.meta.privacyDescription };
}

export default async function PrivacyPage() {
  return (await getLocale()) === "en" ? <PrivacyEn /> : <PrivacyTh />;
}

const link = "text-primary underline-offset-4 hover:underline";

function PrivacyTh() {
  return (
    <LegalPage title="นโยบายความเป็นส่วนตัว">
      <p>
        rep-right เก็บข้อมูลเท่าที่จำเป็นต่อการบันทึกการซ้อมและเตือนเรื่องโหลดเท่านั้น หน้านี้อธิบายตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล
        พ.ศ. 2562 (PDPA) ว่าเราเก็บอะไร ใช้ทำอะไร และคุณมีสิทธิอะไรบ้าง
      </p>

      <Section title="ผู้ควบคุมข้อมูล">
        <Contact />
      </Section>

      <Section title="ข้อมูลที่เก็บ">
        <Bullets
          items={[
            <>
              <b>บัญชี:</b> รหัสบัญชีจากบริการที่คุณใช้เข้าสู่ระบบ (Google หรือ LINE) อีเมล ชื่อที่แสดง
              และลิงก์รูปโปรไฟล์ ซึ่งได้มาตอนเข้าสู่ระบบ (LINE ให้อีเมลเฉพาะเมื่อคุณกดอนุญาตบนหน้าของ LINE) เราเก็บแค่ลิงก์
              ไม่เก็บไฟล์รูป รูปจึงยังโหลดจากเซิร์ฟเวอร์ของ Google หรือ LINE ชื่อที่แสดงแก้เองได้ที่หน้าโปรไฟล์
              เราไม่เห็นและไม่เก็บรหัสผ่าน
            </>,
            <>
              <b>การซ้อม:</b> วันที่ซ้อม ท่า น้ำหนัก จำนวนครั้ง แรงที่เหลือ (ถ้ากรอก) และบันทึกที่คุณพิมพ์เอง
            </>,
            <>
              <b>อาการเจ็บ (ข้อมูลสุขภาพ):</b> เก็บแค่ว่า “มี/ไม่มี” ต่อการซ้อมหนึ่งครั้ง และเก็บเฉพาะเมื่อคุณให้ความยินยอมไว้
            </>,
            <>
              <b>ความยินยอม:</b> คุณยอมรับเรื่องไหน ฉบับไหน และเมื่อไร
            </>,
            <>
              <b>การเข้าสู่ระบบ:</b> ค่าแฮชของโทเค็นสำหรับต่ออายุการเข้าสู่ระบบ เพื่อให้ยกเลิกการเข้าสู่ระบบได้
            </>,
          ]}
        />
        <p>
          ผู้ให้บริการโฮสต์อาจบันทึกข้อมูลทางเทคนิคของการเชื่อมต่อ เช่น หมายเลข IP ไว้ชั่วคราวตามรอบของผู้ให้บริการเอง
          เพื่อความปลอดภัยและแก้ปัญหาระบบ เราไม่ใช้ข้อมูลนี้ระบุตัวคุณ
        </p>
        <p>เราไม่เก็บประวัติโรค ไม่เก็บรายละเอียดอาการบาดเจ็บ ไม่ใช้กล้อง และไม่ขายหรือให้ข้อมูลกับผู้โฆษณา</p>
      </Section>

      <Section title="ใช้ทำอะไร และใช้ฐานทางกฎหมายใด">
        <Bullets
          items={[
            <>
              <b>ให้บริการตามที่คุณใช้งาน</b> (ฐานสัญญา): เข้าสู่ระบบ เก็บประวัติการซ้อม ทำปุ่ม “เหมือนครั้งก่อน” เตือนเมื่อเพิ่มโหลดเร็วเกินไป
              และคำนวณแผนกลับมาซ้อม
            </>,
            <>
              <b>ข้อมูลอาการเจ็บ</b> (ฐานความยินยอมโดยชัดแจ้ง): ใช้เพื่อหยุดแนะนำการเพิ่มน้ำหนักและแนะนำให้พบผู้เชี่ยวชาญเท่านั้น
              ถ้าคุณไม่ให้ความยินยอม แอปยังใช้งานได้ตามปกติ เพียงบันทึกอาการเจ็บไม่ได้
            </>,
            <>
              <b>รักษาความปลอดภัยและแก้ปัญหาระบบ</b> (ฐานประโยชน์โดยชอบด้วยกฎหมาย)
            </>,
          ]}
        />
      </Section>

      <Section title="คุกกี้และที่เก็บในเบราว์เซอร์">
        <p>
          เราใช้คุกกี้สำหรับคงการเข้าสู่ระบบ (อายุไม่เกิน 30 วัน) และตอนเข้าสู่ระบบด้วย LINE จะมีคุกกี้ชั่วคราวอีกตัว (อายุไม่เกิน 10 นาที)
          ไว้ตรวจว่าคำขอกลับมาจาก LINE จริง ทั้งสองตัวสคริปต์ในหน้าเว็บอ่านไม่ได้ และมีคุกกี้จำภาษาที่คุณเลือกในหน้าโปรไฟล์
          (อายุไม่เกิน 1 ปี) ซึ่งเก็บแค่ว่าเลือกภาษาไทยหรืออังกฤษ ใช้ได้โดยไม่ต้องเข้าสู่ระบบ ไม่มีคุกกี้โฆษณาหรือคุกกี้ติดตาม
          และไม่มีระบบวิเคราะห์ผู้เข้าชม หน้าต่างเลือกบัญชีของ Google และหน้าเข้าสู่ระบบของ LINE เป็นของผู้ให้บริการนั้น
          จึงอยู่ภายใต้นโยบายของผู้ให้บริการนั้นด้วย
        </p>
      </Section>

      <Section title="ผู้ให้บริการที่ประมวลผลข้อมูลแทนเรา">
        <Bullets
          items={[
            "Google: ยืนยันตัวตนตอนเข้าสู่ระบบด้วย Google",
            "LINE (LY Corporation): ยืนยันตัวตนตอนเข้าสู่ระบบด้วย LINE",
            "Vercel: ให้บริการหน้าเว็บ",
            "Render: รันระบบหลังบ้าน (ภูมิภาคสิงคโปร์)",
            "Neon: ฐานข้อมูล (ภูมิภาคสิงคโปร์)",
          ]}
        />
        <p>
          ข้อมูลจึงถูกส่งและเก็บนอกประเทศไทย ผู้ให้บริการเหล่านี้ประมวลผลตามคำสั่งของเราภายใต้ข้อตกลงและมาตรการคุ้มครองข้อมูลของแต่ละราย
        </p>
      </Section>

      <Section title="เก็บนานแค่ไหน">
        <Bullets
          items={[
            "ข้อมูลบัญชีและการซ้อมเก็บไว้จนกว่าคุณจะลบบัญชี",
            "ถอนความยินยอมข้อมูลสุขภาพเมื่อไร ข้อมูลอาการเจ็บทั้งหมดจะถูกลบทันที",
            "ลบบัญชีเมื่อไร ข้อมูลทั้งหมดของคุณจะถูกลบออกจากฐานข้อมูลทันที สำเนาสำรองของผู้ให้บริการฐานข้อมูลอาจคงอยู่ช่วงสั้น ๆ จนหมดรอบการเก็บของผู้ให้บริการ",
          ]}
        />
      </Section>

      <Section title="สิทธิของคุณ">
        <p>ตาม PDPA คุณมีสิทธิ</p>
        <Bullets
          items={[
            "ขอเข้าถึงและขอสำเนาข้อมูลของคุณ",
            "ขอแก้ไขข้อมูลให้ถูกต้อง (ชื่อที่แสดงและประวัติการซ้อมแก้เองได้ในแอป)",
            "ขอรับหรือขอให้ส่งข้อมูลในรูปแบบที่อ่านด้วยเครื่องได้",
            "คัดค้าน หรือขอให้ระงับการใช้ข้อมูล",
            <>
              ขอให้ลบข้อมูล ทำเองได้ทันทีที่หน้า{" "}
              <Link href="/account" className={link}>
                โปรไฟล์
              </Link>
            </>,
            "ถอนความยินยอมได้ทุกเมื่อ โดยไม่กระทบสิ่งที่ทำไปก่อนถอน",
            "ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)",
          ]}
        />
        <p>สิทธิที่ยังทำเองในแอปไม่ได้ ติดต่อผู้ควบคุมข้อมูลตามด้านบน</p>
      </Section>

      <Section title="อายุผู้ใช้">
        <p>แอปนี้สำหรับผู้มีอายุ 20 ปีขึ้นไป ถ้าอายุต่ำกว่านั้นต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน</p>
      </Section>

      <Section title="การเปลี่ยนแปลงนโยบาย">
        <p>ถ้าเปลี่ยนนโยบายในสาระสำคัญ แอปจะขอให้คุณอ่านและยอมรับใหม่ก่อนใช้งานส่วนที่ต้องเข้าสู่ระบบต่อ</p>
      </Section>
    </LegalPage>
  );
}

// The English version. The Thai above is the binding text.
function PrivacyEn() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        rep-right collects only what it needs to log your workouts and warn you about load. Following Thailand&apos;s
        Personal Data Protection Act B.E. 2562 (2019) (PDPA), this page explains what we collect, what we use it for,
        and what rights you have.
      </p>

      <Section title="Data controller">
        <Contact />
      </Section>

      <Section title="What we collect">
        <Bullets
          items={[
            <>
              <b>Account:</b> the account ID from the service you sign in with (Google or LINE), your email, display name
              and a link to your profile picture, received when you sign in (LINE shares your email only if you allow it
              on LINE&apos;s page). We keep only the link, not the picture file, so the picture still loads from Google&apos;s
              or LINE&apos;s servers. You can change your display name on your profile page. We never see or keep your
              password.
            </>,
            <>
              <b>Workouts:</b> workout dates, exercises, weights, reps, reps left in reserve (if you enter them) and notes
              you type yourself.
            </>,
            <>
              <b>Pain (health information):</b> only a “yes/no” for each workout, and only if you have given consent.
            </>,
            <>
              <b>Consents:</b> what you agreed to, which version, and when.
            </>,
            <>
              <b>Sign-in:</b> a hash of the token that renews your sign-in, so sign-ins can be cancelled.
            </>,
          ]}
        />
        <p>
          Our hosting providers may briefly record technical connection details, such as IP addresses, on their own
          schedule for security and troubleshooting. We don&apos;t use this to identify you.
        </p>
        <p>
          We don&apos;t collect medical history or injury details, we don&apos;t use the camera, and we don&apos;t sell or
          give data to advertisers.
        </p>
      </Section>

      <Section title="What we use it for, and on what legal basis">
        <Bullets
          items={[
            <>
              <b>Providing the service you use</b> (contract): signing in, keeping your workout history, the “Same as last
              time” button, warning you when you add load too fast, and working out comeback plans.
            </>,
            <>
              <b>Pain information</b> (explicit consent): used only to stop suggesting heavier weights and to suggest
              seeing a professional. If you don&apos;t consent, the app works as usual; you just can&apos;t note pain.
            </>,
            <>
              <b>Keeping the service secure and fixing problems</b> (legitimate interests).
            </>,
          ]}
        />
      </Section>

      <Section title="Cookies and browser storage">
        <p>
          We use a cookie to keep you signed in (for up to 30 days). When you sign in with LINE there is one more,
          short-lived cookie (up to 10 minutes) to check the request really came back from LINE. Scripts on the page
          can&apos;t read either of them. One more cookie remembers the language you pick on your profile page (for up
          to 1 year); it holds only “English” or “Thai” and works without signing in. There are no advertising or
          tracking cookies and no visitor analytics. Google&apos;s account chooser and LINE&apos;s sign-in page belong to
          those providers, so their own policies apply there too.
        </p>
      </Section>

      <Section title="Providers who process data for us">
        <Bullets
          items={[
            "Google: confirms who you are when you sign in with Google",
            "LINE (LY Corporation): confirms who you are when you sign in with LINE",
            "Vercel: serves the website",
            "Render: runs the back end (Singapore region)",
            "Neon: database (Singapore region)",
          ]}
        />
        <p>
          Your data is therefore sent to and stored outside Thailand. These providers process it on our instructions,
          under their own agreements and data protection measures.
        </p>
      </Section>

      <Section title="How long we keep it">
        <Bullets
          items={[
            "Account and workout data are kept until you delete your account.",
            "When you withdraw consent for health information, all your pain notes are deleted right away.",
            "When you delete your account, all your data is removed from the database right away. The database provider's backups may keep a copy for a short time, until their retention period ends.",
          ]}
        />
      </Section>

      <Section title="Your rights">
        <p>Under the PDPA you have the right to:</p>
        <Bullets
          items={[
            "Access your data and get a copy of it",
            "Have your data corrected (you can edit your display name and workout history in the app yourself)",
            "Receive your data, or have it sent elsewhere, in a machine-readable format",
            "Object to, or ask us to restrict, the use of your data",
            <>
              Have your data deleted, which you can do yourself right away on your{" "}
              <Link href="/account" className={link}>
                profile
              </Link>{" "}
              page
            </>,
            "Withdraw consent at any time, without affecting what was done before",
            "Complain to Thailand's Personal Data Protection Committee (PDPC)",
          ]}
        />
        <p>For rights you can&apos;t exercise in the app yet, contact the data controller above.</p>
      </Section>

      <Section title="Age">
        <p>This app is for people aged 20 and over. If you are younger, you need a parent&apos;s or guardian&apos;s consent first.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change this policy in a meaningful way, the app will ask you to read and accept it again before you keep
          using the parts that need you to sign in.
        </p>
      </Section>
    </LegalPage>
  );
}
