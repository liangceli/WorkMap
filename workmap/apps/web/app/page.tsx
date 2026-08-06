"use client";

import Image from "next/image";
import {
  Activity,
  AppWindow,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CircleStop,
  Clock3,
  Eye,
  FileBarChart,
  Globe2,
  HeartPulse,
  KeyRound,
  Laptop,
  LockKeyhole,
  Menu,
  MessageCircle,
  MonitorCheck,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Signal,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./home.module.css";

type ServiceId = "visibility" | "reports" | "office";

const services = [
  {
    id: "visibility" as const,
    label: "Work visibility",
    description: "Understand activity without private content.",
    icon: Activity,
  },
  {
    id: "reports" as const,
    label: "Reports",
    description: "Review clear, role-aware summaries.",
    icon: BarChart3,
  },
  {
    id: "office" as const,
    label: "Virtual Office",
    description: "Meet, signal availability, and interact.",
    icon: Building2,
  },
];

const visibilityFeatures = [
  { icon: AppWindow, text: "Foreground app name + duration" },
  { icon: Globe2, text: "Browser hostname + duration" },
  { icon: Clock3, text: "Idle and locked time stop counting" },
  { icon: UserCheck, text: "Employees can review their own summary" },
];

const collectedSignals = [
  { icon: AppWindow, text: "App name + duration" },
  { icon: Globe2, text: "Domain hostname + duration" },
  { icon: Users, text: "Presence status + room" },
  { icon: HeartPulse, text: "Device heartbeat + coverage" },
  { icon: BookOpenCheck, text: "Policy acknowledgement" },
];

const excludedSignals = [
  "Screenshots or recordings",
  "Keystrokes or clipboard",
  "Window or page titles",
  "Full URLs, paths or queries",
  "Page, form, email or message content",
  "Camera or microphone",
];

const frequentlyAskedQuestions = [
  {
    question: "What does the Desktop Agent do?",
    answer: "It records the foreground app name and active duration. It stops when Windows is idle or locked.",
  },
  {
    question: "What does the Browser Extension do?",
    answer: "It records the active website hostname and duration. It discards paths, queries, titles, and page content.",
  },
  {
    question: "What does WorkMap collect?",
    answer: "App and domain duration, presence, room, device heartbeat, and policy acknowledgement.",
  },
  {
    question: "What does WorkMap never collect?",
    answer: "No screenshots, keystrokes, clipboard, full URLs, private content, camera, or microphone.",
  },
  {
    question: "Can employees stop tracking?",
    answer: "Yes. They can stop the Desktop Agent or disable the Browser Extension.",
  },
  {
    question: "What happens when a device is offline?",
    answer: "A limited local queue retries with backoff when the network returns.",
  },
  {
    question: "What can employees see?",
    answer: "Their own activity summary, device status, and compliance state.",
  },
  {
    question: "What can owners see?",
    answer: "Company summaries and role-allowed employee views inside the same tenant.",
  },
  {
    question: "How does secure pairing work?",
    answer: "A short-lived, one-time code creates a device-scoped credential. Revoking the device stops access.",
  },
  {
    question: "How do I start using WorkMap?",
    answer: "Create an owner account, set up the workspace, invite the team, then pair the Agent and Extension.",
  },
];

export default function HomePage() {
  const [activeService, setActiveService] = useState<ServiceId>("visibility");
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [openQuestion, setOpenQuestion] = useState(0);
  const faqListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-home-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add(styles.revealed));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(styles.revealed);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -12%" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>

      <header className={`${styles.header} ${headerCompact ? styles.headerCompact : ""} ${menuOpen ? styles.headerMenuOpen : ""}`}>
        <nav className={styles.nav} aria-label="Main navigation">
          <a className={styles.brand} href="#top" aria-label="WorkMap home" onClick={closeMenu}>
            <span className={styles.brandMark} aria-hidden="true">WM</span>
            <span>WorkMap</span>
          </a>

          <button
            className={styles.menuButton}
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="home-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={24} />}
          </button>

          <div id="home-mobile-navigation" className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
            <a href="#product" onClick={closeMenu}>Product</a>
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#privacy" onClick={closeMenu}>Privacy</a>
            <a href="#faq" onClick={closeMenu}>FAQ</a>
            <div className={styles.mobileMenuActions}>
              <a href="/login?mode=signin" onClick={closeMenu}>Login</a>
              <a className={styles.mobilePrimaryButton} href="/login?mode=signup" onClick={closeMenu}>Get started</a>
            </div>
          </div>

          <div className={styles.navActions}>
            <a className={styles.signInLink} href="/login?mode=signin">Sign in</a>
            <a className={styles.primaryButton} href="/login?mode=signup">
              Create owner account <ArrowRight size={15} />
            </a>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className={styles.hero} id="top">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Transparent work visibility</p>
              <h1>See the work.<span>Keep the boundary clear.</span></h1>
              <p className={styles.heroLead}>
                WorkMap shows app and domain time, presence, and device status. Never screens, keystrokes, or private content.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButtonLarge} href="/login?mode=signup">
                  Create owner account <ArrowRight size={17} />
                </a>
                <a className={styles.secondaryButtonLarge} href="#privacy">Explore privacy</a>
              </div>
              <div className={styles.heroProof} aria-label="WorkMap principles">
                <Proof icon={<ShieldCheck size={21} />} label="Explainable signals" />
                <Proof icon={<Users size={21} />} label="Employee visibility" />
                <Proof icon={<LockKeyhole size={21} />} label="Clear limits" />
              </div>
            </div>

            <div className={styles.heroMedia}>
              <Image
                className={styles.heroImage}
                src="/marketing/workmap-virtual-office-panorama.png"
                alt="WorkMap Virtual Office showing the complete office map, team presence, navigation, minimap, and visible status controls"
                width={1904}
                height={949}
                priority
                sizes="(max-width: 900px) calc(100vw - 32px), 60vw"
              />
            </div>
          </div>
        </section>

        <section className={`${styles.servicesSection} ${styles.reveal}`} id="product" data-home-reveal>
          <div className={styles.sectionContainer}>
            <div className={styles.serviceTabs} role="tablist" aria-label="WorkMap services">
              {services.map((service) => {
                const Icon = service.icon;
                const selected = activeService === service.id;
                return (
                  <button
                    key={service.id}
                    className={`${styles.serviceTab} ${selected ? styles.serviceTabActive : ""}`}
                    type="button"
                    role="tab"
                    id={`service-tab-${service.id}`}
                    aria-selected={selected}
                    aria-controls={`service-panel-${service.id}`}
                    onClick={() => setActiveService(service.id)}
                  >
                    <Icon size={24} aria-hidden />
                    <span><strong>{service.label}</strong><small>{service.description}</small></span>
                  </button>
                );
              })}
            </div>

            <div
              className={styles.servicePanel}
              id={`service-panel-${activeService}`}
              role="tabpanel"
              aria-labelledby={`service-tab-${activeService}`}
              key={activeService}
            >
              {activeService === "visibility" ? <VisibilityService /> : null}
              {activeService === "reports" ? <ReportsService /> : null}
              {activeService === "office" ? <OfficeService /> : null}
            </div>
          </div>
        </section>

        <section className={`${styles.flowSection} ${styles.reveal}`} id="how-it-works" data-home-reveal>
          <div className={styles.sectionContainer}>
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>How WorkMap works</p>
              <h2>One workspace. Two visible agents. Clear reports.</h2>
            </div>

            <div className={styles.flowRail} aria-label="How WorkMap connects the web app, agents, offline recovery, and reports">
              <FlowStage avatarIndexes={[0]} icon={<MonitorCheck size={27} />} title="WorkMap Web">
                Owners create the workspace and invite the team.
              </FlowStage>
              <FlowArrow />
              <FlowStage avatarIndexes={[1]} icon={<KeyRound size={27} />} title="One-time pairing">
                Employees pair each device with a short-lived code.
              </FlowStage>
              <FlowArrow />
              <div className={styles.agentBranch}>
                <FlowNode icon={<Laptop size={24} />} title="Desktop Agent">App name + duration; idle and locked time stops.</FlowNode>
                <FlowNode icon={<Globe2 size={24} />} title="Browser Extension">Hostname + duration; path, title and content are discarded.</FlowNode>
              </div>
              <FlowArrow />
              <FlowStage icon={<RefreshCw size={27} />} title="Offline recovery">
                A bounded queue retries safely after a network gap.
              </FlowStage>
              <FlowArrow />
              <FlowStage avatarIndexes={[2, 3]} icon={<FileBarChart size={27} />} title="Role-aware reports">
                Employees see their own summary. Owners see aggregate and allowed views.
              </FlowStage>
            </div>
          </div>
        </section>

        <section className={`${styles.privacySection} ${styles.reveal}`} id="privacy" data-home-reveal>
          <div className={styles.sectionContainer}>
            <div className={styles.privacyHeading}>
              <p className={styles.eyebrowLight}>Employee privacy</p>
              <h2>Always visible. Always limited. Always under your control.</h2>
            </div>

            <div className={styles.privacyDiagram}>
              <SignalList title="Collected signals" tone="collected" items={collectedSignals} />
              <div className={`${styles.signalList} ${styles.excludedList}`}>
                <h3>Not collected</h3>
                <ul>{excludedSignals.map((item) => <li key={item}><XCircle size={18} />{item}</li>)}</ul>
              </div>
            </div>

            <div className={styles.controlStrip}>
              <ControlItem avatarIndex={4} icon={<Eye size={24} />} text="Agent and Extension status stays visible" />
              <ControlItem avatarIndex={5} icon={<PauseCircle size={24} />} text="Pause or stop at any time" />
              <ControlItem avatarIndex={6} icon={<FileBarChart size={24} />} text="Review your own summary" />
              <ControlItem avatarIndex={7} icon={<BookOpenCheck size={24} />} text="Review and acknowledge policy" />
            </div>
          </div>
        </section>

        <section className={`${styles.faqSection} ${styles.reveal}`} id="faq" data-home-reveal>
          <div className={`${styles.sectionContainer} ${styles.faqGrid}`}>
            <div className={styles.faqIntro}>
              <p className={styles.eyebrow}>FAQ</p>
              <h2>Questions? We keep the answers clear.</h2>
              <p>Everything you need to know about WorkMap and your privacy.</p>
              <div className={styles.faqHelp}>
                <MessageCircle size={25} />
                <strong>Still have questions?</strong>
                <span>Start with a workspace and review the policy before pairing a device.</span>
                <a href="/login?mode=signup">Create an account <ArrowRight size={15} /></a>
              </div>
            </div>

            <div className={styles.faqList} ref={faqListRef} aria-label="Frequently asked questions">
              {frequentlyAskedQuestions.map((item, index) => {
                const open = openQuestion === index;
                return (
                  <article className={`${styles.faqItem} ${open ? styles.faqItemOpen : ""}`} key={item.question}>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => setOpenQuestion((current) => current === index ? -1 : index)}
                    >
                      <span className={styles.faqIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.question}</strong>
                      <span className={styles.faqToggle} aria-hidden>{open ? "-" : "+"}</span>
                    </button>
                    <div className={styles.faqAnswer} id={`faq-answer-${index}`} hidden={!open}>
                      <p>{item.answer}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${styles.consentSection} ${styles.reveal}`} data-home-reveal>
          <div className={styles.consentInner}>
            <blockquote>WorkMap works with your people, not around them.</blockquote>
            <p>Transparent signals.<br />Clear boundaries.<br />Fair by design.</p>
            <p>Policy first.<br />People always.</p>
            <MarketingAvatar index={1} label="WorkMap team avatar" size="large" />
          </div>
          <div className={styles.ctaBar}>
            <strong>Transparency you can trust. Visibility you can explain.</strong>
            <div>
              <a className={styles.primaryButtonLarge} href="/login?mode=signup">Create owner account <ArrowRight size={17} /></a>
              <a className={styles.darkSecondaryButton} href="/login?mode=signin">Sign in</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <a className={styles.brandLight} href="#top"><span className={styles.brandMark}>WM</span>WorkMap</a>
            <p>Transparent work visibility that respects privacy and builds trust.</p>
          </div>
          <div><strong>Product</strong><a href="#product">Work visibility</a><a href="#how-it-works">How it works</a><a href="#product">Reports</a><a href="#product">Virtual Office</a></div>
          <div><strong>Privacy</strong><a href="#privacy">What we collect</a><a href="#privacy">What we never collect</a><a href="#privacy">Employee controls</a><a href="#faq">FAQ</a></div>
          <div><strong>Account</strong><a href="/login?mode=signin">Sign in</a><a href="/login?mode=signup">Create owner account</a><a href="/compliance">Review policy</a></div>
        </div>
        <div className={styles.footerBottom}><span>WorkMap Pty Ltd</span><span>Privacy-conscious work visibility.</span></div>
      </footer>
    </div>
  );
}

function Proof({ icon, label }: { icon: ReactNode; label: string }) {
  return <div>{icon}<span>{label}</span></div>;
}

function VisibilityService() {
  return (
    <>
      <div className={styles.serviceIntro}>
        <p className={styles.eyebrow}>Work visibility</p>
        <h2>Progress you can explain. Privacy people can see.</h2>
        <p>WorkMap records the minimum signals needed to understand work patterns - nothing more.</p>
        <div className={styles.featureGrid}>
          {visibilityFeatures.map(({ icon: Icon, text }) => <div key={text}><Icon size={25} /><span>{text}</span></div>)}
        </div>
      </div>
      <ProductPagePreview
        src="/marketing/workmap-dashboard-demo.png"
        alt="WorkMap Dashboard with fictional employees Mia Manager, Ethan Engineer, and Sofia Sales"
      />
    </>
  );
}

function ReportsService() {
  return (
    <>
      <div className={styles.serviceIntro}>
        <p className={styles.eyebrow}>Reports</p>
        <h2>Patterns you can review. Boundaries you can explain.</h2>
        <p>Employees see their own activity. Owners see company summaries and role-allowed detail.</p>
        <a className={styles.inlineLink} href="/reports">View reports <ArrowRight size={16} /></a>
      </div>
      <ProductPagePreview
        src="/marketing/workmap-reports-demo.png"
        alt="WorkMap company report using fictional demo workspace data"
      />
    </>
  );
}

function ProductPagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={styles.productPreview}>
      <Image src={src} alt={alt} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 58vw" />
    </div>
  );
}

function OfficeService() {
  return (
    <>
      <div className={styles.serviceIntro}>
        <p className={styles.eyebrow}>Virtual Office</p>
        <h2>A shared place to be present, available, and easy to reach.</h2>
        <p>See who is around, move between rooms, wave, send a quick message, and understand room context.</p>
        <ul className={styles.officeFeatureList}>
          <li><Signal size={18} />Live presence</li>
          <li><CircleStop size={18} />Focus, busy, away, and offline states</li>
          <li><Building2 size={18} />Room context</li>
          <li><MessageCircle size={18} />Wave and quick message</li>
        </ul>
        <a className={styles.inlineLink} href="/virtual-office">Open Virtual Office <ArrowRight size={16} /></a>
      </div>
      <div className={styles.officePreview}>
        <Image src="/marketing/workmap-virtual-office-panorama.png" alt="Complete WorkMap Virtual Office" width={1904} height={949} sizes="(max-width: 900px) 100vw, 58vw" />
      </div>
    </>
  );
}

function FlowStage({ icon, title, children, avatarIndexes = [] }: { icon: ReactNode; title: string; children: ReactNode; avatarIndexes?: number[] }) {
  return (
    <div className={styles.flowStage}>
      {avatarIndexes.length ? <div className={styles.flowAvatars}>{avatarIndexes.map((index) => <MarketingAvatar key={index} index={index} label="WorkMap avatar" />)}</div> : null}
      <FlowNode icon={icon} title={title}>{children}</FlowNode>
    </div>
  );
}

function FlowNode({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className={styles.flowNode}><span>{icon}</span><div><h3>{title}</h3><p>{children}</p></div></div>;
}

function FlowArrow() {
  return <span className={styles.flowArrow} aria-hidden><ArrowRight size={20} /></span>;
}

function SignalList({ title, items }: { title: string; tone: "collected"; items: Array<{ icon: typeof AppWindow; text: string }> }) {
  return (
    <div className={`${styles.signalList} ${styles.collectedList}`}>
      <h3>{title}</h3>
      <ul>{items.map(({ icon: Icon, text }) => <li key={text}><Icon size={18} />{text}</li>)}</ul>
    </div>
  );
}

function ControlItem({ avatarIndex, icon, text }: { avatarIndex: number; icon: ReactNode; text: string }) {
  return <article><MarketingAvatar index={avatarIndex} label="WorkMap employee avatar" size="small" /><span className={styles.controlIcon}>{icon}</span><p>{text}</p></article>;
}

function MarketingAvatar({ index, label, size = "medium" }: { index: number; label: string; size?: "small" | "medium" | "large" }) {
  return (
    <Image
      className={`${styles.marketingAvatar} ${styles[`avatar${size[0].toUpperCase()}${size.slice(1)}`]}`}
      src={`/marketing/avatars/avatar-${String(index + 1).padStart(2, "0")}.png`}
      alt={label}
      width={64}
      height={96}
    />
  );
}
