import { SiteShell } from '../../shared/ui/siteShell';

const CTA_BUTTON_CLASS =
  'inline-flex items-center rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-50';

const CARD_BUTTON_CLASS =
  'mt-3 inline-flex items-center rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-50';

export default function App() {
  const landingNavItems = [
    { href: '#about', label: 'About' },
    { href: '#projects', label: 'Projects' },
    { href: 'https://pillyliu.com/lpl-stats/', label: 'Stats' },
    { href: 'https://pillyliu.com/lpl-standings/', label: 'Standings' },
    { href: 'https://pillyliu.com/lpl-targets/', label: 'Targets' },
    { href: 'https://pillyliu.com/lpl-library/', label: 'Library' },
  ] as const;

  return (
    <SiteShell
      title='Peter Liu'
      activeLabel='Home'
      navItems={landingNavItems}
      brandLabel='PILLYLIU'
    >
      <section id='about' className='scroll-mt-24 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 md:p-6'>
        <div className='grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-start'>
          <div>
            <h2 className='m-0 text-[clamp(1.55rem,2.8vw,2.35rem)] font-semibold leading-[1.18] tracking-[-0.02em] text-neutral-100'>
              Pinball • Pizza • Piano • Processors • Physician
            </h2>
            <p className='mt-2.5 text-neutral-400'>
              Hi, I&apos;m Peter - passionate about pinball, powered by pizza, tempered by piano, driven by pixels and
              processors, and proudly a pee physician (urologist).
            </p>
            <div className='mt-4 flex flex-wrap gap-2.5'>
              <a className={`${CTA_BUTTON_CLASS} border-emerald-500/60 bg-emerald-600/25 text-emerald-100`} href='https://pillyliu.com/lpl-stats/'>
                View League <strong className='ml-1'>Stats</strong>
              </a>
              <a className={CTA_BUTTON_CLASS} href='https://pillyliu.com/lpl-standings/'>
                View <strong className='ml-1'>Standings</strong>
              </a>
              <a className={CTA_BUTTON_CLASS} href='https://pillyliu.com/lpl-targets/'>
                View <strong className='ml-1'>Targets</strong>
              </a>
              <a className={CTA_BUTTON_CLASS} href='https://pillyliu.com/lpl-library/'>
                Open <strong className='ml-1'>Library</strong>
              </a>
              <a className={CTA_BUTTON_CLASS} href='http://twitch.tv/pillyliu' target='_blank' rel='noreferrer'>
                Watch on <strong className='ml-1'>Twitch</strong>
              </a>
            </div>
          </div>

          <figure className='m-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900'>
            <img
              className='block h-full min-h-[210px] w-full object-cover md:min-h-[270px] md:max-h-[360px]'
              src='/peter-pinball.jpg'
              alt='Peter Liu playing pinball'
            />
          </figure>
        </div>
      </section>

      <section id='projects' className='scroll-mt-24 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 md:p-6'>
        <h2 className='m-0 text-lg font-semibold tracking-tight text-neutral-100'>Projects</h2>
        <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <article className='rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4'>
            <h3 className='m-0 text-base font-semibold text-neutral-100'>League Stats Viewer</h3>
            <p className='mt-2 text-sm text-neutral-400'>Interactive filters with machine-specific analytics.</p>
            <a className={CARD_BUTTON_CLASS} href='https://pillyliu.com/lpl-stats/'>
              Open Stats
            </a>
          </article>

          <article className='rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4'>
            <h3 className='m-0 text-base font-semibold text-neutral-100'>Standings Dashboard</h3>
            <p className='mt-2 text-sm text-neutral-400'>Latest season by default; quick switch to past seasons.</p>
            <a className={CARD_BUTTON_CLASS} href='https://pillyliu.com/lpl-standings/'>
              Open Standings
            </a>
          </article>

          <article className='rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4'>
            <h3 className='m-0 text-base font-semibold text-neutral-100'>Performance Targets</h3>
            <p className='mt-2 text-sm text-neutral-400'>Percentile-based goals per machine for practice and competition.</p>
            <a className={CARD_BUTTON_CLASS} href='https://pillyliu.com/lpl-targets/'>
              Open Targets
            </a>
          </article>

          <article className='rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4'>
            <h3 className='m-0 text-base font-semibold text-neutral-100'>Pinball Library</h3>
            <p className='mt-2 text-sm text-neutral-400'>Rulesheets, guides, and videos, all in one place.</p>
            <a className={CARD_BUTTON_CLASS} href='https://pillyliu.com/lpl-library/'>
              Open Library
            </a>
          </article>
        </div>
      </section>

      <section className='rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 md:p-6'>
        <h2 className='m-0 text-lg font-semibold tracking-tight text-neutral-100'>Contact</h2>
        <p className='mt-2 text-sm text-neutral-400'>Prefer email or morse code via telegraph.</p>
        <p className='mt-3'>
          <a className={CARD_BUTTON_CLASS} href='mailto:pillyliu@gmail.com'>
            Email Peter
          </a>{' '}
          <a className={CARD_BUTTON_CLASS} href='http://twitch.tv/pillyliu' target='_blank' rel='noreferrer'>
            Twitch
          </a>
        </p>
      </section>

      <footer className='px-1 text-sm text-neutral-500'>
        <p>&copy; 2026 Peter Liu. Built with caffeine.</p>
      </footer>
    </SiteShell>
  );
}
