import React from "react";

const App: React.FC = () => {
    return (
        <>
        <header>
            <div className="nav">
                <div className="brand">
                    <h1>Peter Liu</h1>
                    <span className="tag">pillyliu</span>
                </div>
                <nav className="links">
                    <a href="#about">About</a>
                    <a href="#projects">Projects</a>
                    <a href="https://pillyliu.com/lpl_stats/">Stats</a>
                    <a href="https://pillyliu.com/lpl_standings/">Standings</a>
                    <a href="https://pillyliu.com/lpl_targets/">Targets</a>
                    <a href="https://pillyliu.com/lpl_library/">Library</a>
                    <a href="#contact">Contact</a>
                </nav>
            </div>
        </header>

        <main>
            <section className="hero" id="about">
                <div className="hero-grid">
                    <div>
                        <h2>
                            Pinball • Pizza • Piano • Pixels &amp; Processors • Pee Doctor
                        </h2>
                        <p className="lead">
                            Hi, I’m Peter — passionate about pinball, powered by pizza,
                            tempered by piano, driven by pixels and processors, and proudly a
                            pee physician (urologist).
                        </p>
                        <div className="cta">
                            <a
                                className="btn primary"
                                href="https://pillyliu.com/lpl_stats/"
                            >
                                View League <strong>Stats</strong>
                            </a>
                            <a
                                className="btn"
                                href="https://pillyliu.com/lpl_standings/"
                            >
                                View <strong>Standings</strong>
                            </a>
                            <a className="btn" href="https://pillyliu.com/lpl_targets/">
                                View <strong>Targets</strong>
                            </a>
                            <a className="btn" href="https://pillyliu.com/lpl_library/">
                                Open <strong>Library</strong>
                            </a>
                            <a className="btn" href="http://twitch.tv/pillyliu" target="_blank" rel="noreferrer">
                                Watch on <strong>Twitch</strong>
                            </a>
                        </div>
                    </div>
                    <figure className="hero-photo-wrap">
                        <img
                            className="hero-photo"
                            src="/peter-pinball.jpg"
                            alt="Peter Liu playing pinball"
                        />
                    </figure>
                </div>
            </section>

          <section id="projects">
            <h2>Projects</h2>
            <div className="card-grid">
                <article className="card">
                    <h3>League Stats Viewer</h3>
                    <p className="muted">
                        Interactive filters with machine-specific analytics.
                    </p>
                    <p>
                        <a className="btn" href="https://pillyliu.com/lpl_stats/">
                            Open Stats
                        </a>
                    </p>
                </article>

                <article className="card">
                    <h3>Standings Dashboard</h3>
                    <p className="muted">
                        Latest season by default; quick switch to past seasons.
                    </p>
                    <p>
                        <a className="btn" href="https://pillyliu.com/lpl_standings/">
                            Open Standings
                        </a>
                    </p>
                </article>

                <article className="card">
                    <h3>Performance Targets</h3>
                    <p className="muted">
                        Percentile-based goals per machine for practice &amp;
                        competition.
                    </p>
                    <p>
                        <a className="btn" href="https://pillyliu.com/lpl_targets/">
                            Open Targets
                        </a>
                    </p>
                </article>
                <article className="card">
                  <h3>Pinball Library</h3>
                  <p className="muted">Rulesheets, guides, and machine pages — all in one place.</p>
                  <p>
                    <a className="btn" href="https://pillyliu.com/lpl_library/">
                      Open Library
                  </a>
              </p>
          </article>
      </div>
  </section>

<section id="contact">
    <h2>Contact</h2>
    <p className="muted">
        Prefer email. Smoke signals only for multiballs.
    </p>
    <p>
        <a className="btn" href="mailto:pillyliu@gmail.com">
            Email Peter
        </a>
        {" "}
        <a className="btn" href="http://twitch.tv/pillyliu" target="_blank" rel="noreferrer">
            Twitch
        </a>
    </p>
</section>

<footer>
    <p>&copy; 2026 Peter Liu. Built with caffeine and curiosity.</p>
</footer>
</main>
</>
);
};

export default App;
