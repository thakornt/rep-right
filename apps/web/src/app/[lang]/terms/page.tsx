import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getMessages } from "@/lib/i18n/server";

import { Bullets, Contact, LegalPage, Section } from "../legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.terms, description: t.meta.termsDescription };
}

export default async function TermsPage() {
  return (await getLocale()) === "en" ? <TermsEn /> : <TermsTh />;
}

const link = "text-primary underline-offset-4 hover:underline";

function TermsTh() {
  return (
    <LegalPage title="ข้อตกลงการใช้งาน">
      <p>การใช้ส่วนที่ต้องเข้าสู่ระบบของ rep-right (บันทึกการซ้อม คำเตือน และแผนกลับมาซ้อม) ต้องยอมรับข้อตกลงนี้ก่อน</p>

      <Section title="เป็นแนวทางทั่วไป ไม่ใช่คำแนะนำทางการแพทย์">
        <Bullets
          items={[
            "ภาพ 3D คำอธิบายฟอร์ม คำเตือนเรื่องโหลด และแผนกลับมาซ้อม เป็นแนวทางทั่วไปสำหรับผู้ที่ไม่มีอาการบาดเจ็บ",
            "แอปไม่วินิจฉัยอาการบาดเจ็บ ไม่ตรวจฟอร์มของคุณ และไม่แทนเทรนเนอร์ แพทย์ หรือนักกายภาพบำบัด",
            "ร่างกายแต่ละคนต่างกัน ลงลึกหรือยกหนักเท่าที่ร่างกายของคุณยังคุมท่าได้",
            "ถ้ารู้สึกเจ็บระหว่างซ้อม ให้หยุดและปรึกษาผู้เชี่ยวชาญ",
            "ถ้ามีโรคประจำตัว ตั้งครรภ์ หรือเคยบาดเจ็บ ควรปรึกษาแพทย์ก่อนเริ่มหรือเพิ่มการซ้อม",
          ]}
        />
      </Section>

      <Section title="ความรับผิดชอบของคุณ">
        <Bullets
          items={[
            "คุณเป็นผู้ตัดสินใจว่าจะซ้อมอย่างไร และรับผิดชอบความปลอดภัยของตัวเองระหว่างซ้อม",
            "กรอกข้อมูลการซ้อมตามจริง คำเตือนจะแม่นเท่าข้อมูลที่กรอก",
            "ใช้บัญชีของตัวเองเท่านั้น และไม่พยายามเข้าถึงข้อมูลของผู้อื่นหรือรบกวนการทำงานของระบบ",
          ]}
        />
      </Section>

      <Section title="ขอบเขตความรับผิด">
        <p>
          เราพยายามให้เนื้อหาถูกต้องและระบบใช้งานได้ แต่ให้บริการตามสภาพที่เป็นอยู่ ไม่รับประกันว่าจะไม่มีข้อผิดพลาดหรือใช้งานได้ตลอดเวลา
          และไม่รับผิดชอบต่อการบาดเจ็บหรือความเสียหายจากการซ้อม เว้นแต่กฎหมายกำหนดไว้เป็นอย่างอื่น
        </p>
      </Section>

      <Section title="ข้อมูลของคุณ">
        <p>
          ข้อมูลการซ้อมเป็นของคุณ เราเก็บและใช้ตาม{" "}
          <Link href="/privacy" className={link}>
            นโยบายความเป็นส่วนตัว
          </Link>{" "}
          และคุณลบบัญชีพร้อมข้อมูลทั้งหมดได้ทุกเมื่อ
        </p>
      </Section>

      <Section title="การเปลี่ยนแปลงและการยุติบริการ">
        <p>
          ถ้าเปลี่ยนข้อตกลงในสาระสำคัญ แอปจะขอให้คุณยอมรับใหม่ เราอาจปรับหรือหยุดให้บริการได้ ถ้าจะหยุดให้บริการถาวรจะแจ้งล่วงหน้าตามสมควร
          ข้อตกลงนี้อยู่ภายใต้กฎหมายไทย
        </p>
      </Section>

      <Section title="ติดต่อ">
        <Contact />
      </Section>
    </LegalPage>
  );
}

// The English version. The Thai above is the binding text.
function TermsEn() {
  return (
    <LegalPage title="Terms of use">
      <p>
        To use the parts of rep-right that need you to sign in (workout logging, warnings and the comeback plan), you
        first need to accept these terms.
      </p>

      <Section title="General guidance, not medical advice">
        <Bullets
          items={[
            "The 3D views, form explanations, load warnings and comeback plans are general guidance for people without an injury.",
            "The app does not diagnose injuries, does not check your form, and does not replace a coach, doctor or physiotherapist.",
            "Everybody's body is different. Go as deep, or lift as heavy, as your body can still control.",
            "If something hurts while you train, stop and talk to a professional.",
            "If you have a medical condition, are pregnant, or have been injured before, talk to a doctor before you start or increase your training.",
          ]}
        />
      </Section>

      <Section title="Your responsibilities">
        <Bullets
          items={[
            "You decide how to train, and you are responsible for your own safety while training.",
            "Log your workouts truthfully: the warnings are only as accurate as what you enter.",
            "Use only your own account, and don't try to access other people's data or disrupt the service.",
          ]}
        />
      </Section>

      <Section title="Limits of liability">
        <p>
          We try to keep the content accurate and the service working, but it is provided as it is. We don&apos;t
          guarantee it will be free of errors or always available, and we are not responsible for injury or loss from
          training, except where the law says otherwise.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          Your workout data is yours. We keep and use it as described in the{" "}
          <Link href="/privacy" className={link}>
            privacy policy
          </Link>
          , and you can delete your account and all its data at any time.
        </p>
      </Section>

      <Section title="Changes and ending the service">
        <p>
          If we change these terms in a meaningful way, the app will ask you to accept them again. We may change or stop
          the service; if we stop it for good, we will give reasonable notice. These terms are governed by Thai law.
        </p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </LegalPage>
  );
}
