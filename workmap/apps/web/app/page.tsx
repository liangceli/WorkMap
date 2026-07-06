"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileBarChart,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import styles from "./home.module.css";

type ProductTab = "visibility" | "reports" | "office";

const tabs: Array<{
  id: ProductTab;
  label: string;
  description: string;
  icon: typeof Activity;
}> = [
  {
    id: "visibility",
    label: "Work visibility",
    description: "Understand activity and collaboration at a glance.",
    icon: Activity,
  },
  {
    id: "reports",
    label: "Reports",
    description: "Track trends and plan with confidence.",
    icon: BarChart3,
  },
  {
    id: "office",
    label: "Virtual Office",
    description: "See who is around and where work is happening.",
    icon: Building2,
  },
];

const collectedSignals = [
  ["Presence signals", "Status, workspace presence and time segments"],
  ["App and domain duration", "Privacy-minimised work patterns over time"],
  ["Acknowledgement records", "Clear policy notice and consent timestamps"],
];

const excludedSignals = [
  "Screenshots or screen recordings",
  "Keystrokes, clipboard or form inputs",
  "Camera, microphone or private messages",
  "Email or webpage body content",
  "Passwords or full URL paths",
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ProductTab>("visibility");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Main navigation">
          <a className={styles.brand} href="#top" aria-label="WorkMap home">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>WorkMap</span>
          </a>

          <button
            className={styles.menuButton}
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
            <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
            <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#company" onClick={() => setMenuOpen(false)}>Company</a>
          </div>

          <div className={styles.navActions}>
            <a className={styles.signInLink} href="/login?mode=signin">Sign in</a>
            <a className={styles.primaryButton} href="/login?mode=signup">
              Create owner account <ArrowRight size={17} />
            </a>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className={styles.hero} id="top">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Privacy-conscious work visibility</p>
            <h1>
              Clarity for teams.
              <span>Dignity for people.</span>
            </h1>
            <p className={styles.heroLead}>
              WorkMap connects virtual presence and privacy-minimised work signals, so leaders can support work without watching every move.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButtonLarge} href="/login?mode=signup">
                Create owner account <ArrowRight size={19} />
              </a>
              <a className={styles.secondaryButtonLarge} href="#privacy">
                See how privacy works
              </a>
            </div>

            <div className={styles.heroProof} aria-label="WorkMap principles">
              <div><Users size={22} /><span><strong>Support your team</strong> in the moments that matter.</span></div>
              <div><ShieldCheck size={22} /><span><strong>Privacy by design.</strong> No surveillance. No surprises.</span></div>
              <div><CheckCircle2 size={22} /><span><strong>Clear boundaries</strong> around every work signal.</span></div>
            </div>
          </div>

          <HeroPresenceMap />
        </section>

        <section className={styles.productSection} id="product">
          <div className={styles.tabList} role="tablist" aria-label="WorkMap product areas">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={24} aria-hidden="true" />
                  <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
                </button>
              );
            })}
          </div>

          <div
            className={styles.productPanel}
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === "visibility" && <VisibilityPanel />}
            {activeTab === "reports" && <ReportsPanel />}
            {activeTab === "office" && <OfficePanel />}
          </div>
        </section>

        <section className={styles.stepsSection} id="how-it-works">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>How it works</p>
            <h2>Get started in 3 simple steps</h2>
            <p>From owner setup to shared visibility in minutes.</p>
          </div>
          <div className={styles.stepsGrid}>
            <Step number="1" icon={UserPlus} title="Create your owner account">
              Set up your organisation, invite co-owners, and define basic settings.
            </Step>
            <Step number="2" icon={Building2} title="Build your office">
              Create rooms and teams that mirror how your organisation works.
            </Step>
            <Step number="3" icon={Users} title="Invite your team">
              Send secure invites. People join, set their status, and start showing up.
            </Step>
          </div>
        </section>

        <section className={styles.privacySection} id="privacy">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Transparent by design</p>
            <h2>We collect less. On purpose.</h2>
            <p>WorkMap provides privacy-minimised telemetry—not productivity scores or disciplinary decisions.</p>
          </div>
          <div className={styles.privacyGrid}>
            <article className={styles.privacyColumn}>
              <div className={styles.privacyTitle}><CheckCircle2 size={28} /><div><h3>What we collect</h3><p>Signals that help your organisation understand work patterns.</p></div></div>
              <ul>
                {collectedSignals.map(([title, copy]) => (
                  <li key={title}><Check size={18} /><span><strong>{title}</strong><small>{copy}</small></span></li>
                ))}
              </ul>
            </article>
            <article className={`${styles.privacyColumn} ${styles.privacyColumnExcluded}`}>
              <div className={styles.privacyTitle}><LockKeyhole size={28} /><div><h3>What we never collect</h3><p>Personal, private, or sensitive content stays outside WorkMap.</p></div></div>
              <ul>
                {excludedSignals.map((signal) => <li key={signal}><X size={17} /><span>{signal}</span></li>)}
              </ul>
            </article>
          </div>
          <div className={styles.privacyFooter}>
            <ShieldCheck size={20} />
            <span>Designed around transparent notice, employee access, and clear collection boundaries.</span>
            <a href="/compliance">Explore compliance <ArrowRight size={16} /></a>
          </div>
        </section>

        <section className={styles.finalCta} id="company">
          <div>
            <p className={styles.eyebrowLight}>Start with clarity</p>
            <h2>Lead with confidence. Respect people.</h2>
            <p>Create the workspace first, then invite employees through secure links.</p>
          </div>
          <div className={styles.finalActions}>
            <a className={styles.primaryButtonLarge} href="/login?mode=signup">Create owner account <ArrowRight size={18} /></a>
            <a className={styles.darkSecondaryButton} href="/login?mode=signin">Sign in</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <a className={styles.brandLight} href="#top"><Sparkles size={24} /> WorkMap</a>
            <p>Clear work visibility for modern, privacy-conscious teams.</p>
          </div>
          <div><strong>Product</strong><a href="#product">Work visibility</a><a href="#product">Reports</a><a href="#product">Virtual Office</a></div>
          <div><strong>Privacy</strong><a href="#privacy">What we collect</a><a href="/compliance">Compliance</a><a href="#privacy">Transparency</a></div>
          <div><strong>Get started</strong><a href="/login?mode=signup">Owner account</a><a href="/login?mode=signin">Sign in</a><a href="#how-it-works">How it works</a></div>
        </div>
        <div className={styles.footerBottom}><span>WorkMap Pty Ltd</span><span>Built for controlled pilot use in Australia.</span></div>
      </footer>
    </div>
  );
}

function HeroPresenceMap() {
  const people = [
    ["AL", "Focus Room", "online"],
    ["MK", "Collab Space", "online"],
    ["JS", "Quiet Room", "focus"],
    ["PN", "Work Café", "online"],
  ];
  return (
    <div className={styles.heroVisual} aria-label="Demo view of team presence across a WorkMap office">
      <div className={styles.visualToolbar}><span>Melbourne Office <ChevronDown size={14} /></span><span>9:41am AEST</span><span className={styles.livePill}><i /> Live demo</span></div>
      <div className={styles.mapCanvas}>
        <div className={`${styles.room} ${styles.roomOne}`}><strong>Focus Room</strong><small>2 people</small></div>
        <div className={`${styles.room} ${styles.roomTwo}`}><strong>Collab Space</strong><small>5 people</small></div>
        <div className={`${styles.room} ${styles.roomThree}`}><strong>Quiet Room</strong><small>1 person</small></div>
        <div className={`${styles.room} ${styles.roomFour}`}><strong>Work Café</strong><small>4 people</small></div>
        {people.map(([initials, place, state], index) => (
          <div key={initials} className={`${styles.mapPerson} ${styles[`person${index + 1}`]}`} title={`${initials}, ${place}`}>
            <span>{initials}</span><i className={state === "focus" ? styles.focusDot : ""} />
          </div>
        ))}
        <div className={styles.mapMessage}>Presence reflects where work happens—not what gets done.</div>
      </div>
      <div className={styles.timelineCard}>
        <div className={styles.timelineHeader}><span>8am</span><strong>9am</strong><span>10am</span><span>11am</span><span>12pm</span></div>
        {[64, 78, 52].map((width, index) => <div className={styles.timelineRow} key={width}><span>{["AL", "MK", "JS"][index]}</span><i style={{ width: `${width}%` }} /></div>)}
      </div>
      <div className={styles.mapLegend}><span><i className={styles.greenDot} /> In office</span><span><i className={styles.blueDot} /> Focus</span><span><i className={styles.grayDot} /> Offline</span></div>
    </div>
  );
}

function VisibilityPanel() {
  return (
    <>
      <div className={styles.panelCopy}>
        <p className={styles.eyebrow}>Work visibility</p>
        <h2>See work patterns without watching people.</h2>
        <p>Understand app and domain time, presence, and team rhythms with clear privacy boundaries.</p>
        <ul className={styles.featureList}>
          <li><CheckCircle2 size={19} /> Visible foreground app duration</li>
          <li><CheckCircle2 size={19} /> Active, idle, and offline distinctions</li>
          <li><CheckCircle2 size={19} /> Team trends without employee scoring</li>
        </ul>
      </div>
      <div className={styles.dashboardMock} aria-label="Demo Work visibility dashboard">
        <DemoSidebar active="Overview" />
        <div className={styles.dashboardContent}>
          <div className={styles.mockHeader}><div><small>Demo workspace</small><strong>Overview</strong></div><span>Today <ChevronDown size={13} /></span></div>
          <div className={styles.metricGrid}>
            <Metric label="People online" value="23" note="of 45" />
            <Metric label="In meetings" value="10" note="of 45" />
            <Metric label="Focused time" value="2h 15m" note="avg / person" />
            <Metric label="After hours" value="3" note="working now" />
          </div>
          <div className={styles.chartGrid}>
            <BarList title="App time (top)" rows={[["Microsoft 365", 82, "2h 40m"], ["Google Workspace", 60, "1h 35m"], ["Slack", 45, "1h 10m"], ["Figma", 30, "45m"]]} />
            <BarList title="Domain time (top)" rows={[["workmap.co", 88, "3h 05m"], ["google.com", 62, "2h 10m"], ["slack.com", 48, "1h 20m"], ["figma.com", 28, "45m"]]} />
          </div>
          <div className={styles.presenceChart}><strong>Presence timeline</strong>{[74, 55, 84].map((width, index) => <div key={width}><span>{["Marketing", "Product", "Customer Success"][index]}</span><i style={{ width: `${width}%` }} /></div>)}</div>
        </div>
        <aside className={styles.guardrailCard}><ShieldCheck size={22} /><strong>Privacy guardrails</strong><span>No keystrokes, content or messages</span><span>No individual productivity scoring</span><span>Clear personal-space boundaries</span></aside>
      </div>
    </>
  );
}

function ReportsPanel() {
  return (
    <>
      <div className={styles.panelCopy}>
        <p className={styles.eyebrow}>Reports</p>
        <h2>Turn reliable patterns into better planning.</h2>
        <p>Review active time, app and domain duration, and team-level trends without turning people into a score.</p>
        <ul className={styles.featureList}><li><CheckCircle2 size={19} /> Company and employee-authorised views</li><li><CheckCircle2 size={19} /> Clear date and department filters</li><li><CheckCircle2 size={19} /> Export-ready summaries</li></ul>
      </div>
      <div className={styles.simpleMock}><FileBarChart size={38} /><div><small>Demo report</small><h3>Team activity summary</h3><p>Visible foreground time · Week of 6 July</p></div><div className={styles.reportBars}>{[82, 65, 58, 42].map((width) => <i key={width} style={{ width: `${width}%` }} />)}</div><div className={styles.reportSummary}><span><strong>31h 42m</strong> active time</span><span><strong>5</strong> team members</span><span><strong>92%</strong> data coverage</span></div></div>
    </>
  );
}

function OfficePanel() {
  return (
    <>
      <div className={styles.panelCopy}>
        <p className={styles.eyebrow}>Virtual Office</p>
        <h2>Give distributed work a shared place.</h2>
        <p>See workspace presence, rooms, status and recency in one lightweight office view.</p>
        <ul className={styles.featureList}><li><CheckCircle2 size={19} /> Room and desk presence</li><li><CheckCircle2 size={19} /> Realtime movement with polling fallback</li><li><CheckCircle2 size={19} /> Honest local-only placeholders</li></ul>
      </div>
      <div className={`${styles.simpleMock} ${styles.officeMock}`}><Building2 size={38} /><div><small>Demo office</small><h3>Main Office</h3><p>23 people present · 4 rooms active</p></div><div className={styles.officeRooms}><span>Focus room <b>2</b></span><span>Product <b>6</b></span><span>Marketing <b>5</b></span><span>Open area <b>10</b></span></div></div>
    </>
  );
}

function DemoSidebar({ active }: { active: string }) {
  return <aside className={styles.demoSidebar}><strong>W</strong><span className={styles.demoActive}><LayoutDashboard size={14} />{active}</span><span><Users size={14} />People</span><span><MonitorCheck size={14} />Activity</span><span><BarChart3 size={14} />Reports</span></aside>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className={styles.metric}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

function BarList({ title, rows }: { title: string; rows: Array<[string, number, string]> }) {
  return <div className={styles.barList}><strong>{title}</strong>{rows.map(([label, width, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${width}%` }} /></i><small>{value}</small></div>)}</div>;
}

function Step({ number, icon: Icon, title, children }: { number: string; icon: typeof UserPlus; title: string; children: ReactNode }) {
  return <article className={styles.step}><div className={styles.stepIcon}><Icon size={30} /><span>{number}</span></div><h3>{title}</h3><p>{children}</p></article>;
}
