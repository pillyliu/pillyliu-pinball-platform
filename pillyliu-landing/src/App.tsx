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
                <div>
                    <h2>
                        Pinball • Pizza • Piano • Pixels &amp; Processors • Pee Doctor
                    </h2>
                    <div className="p-list">
                        <span className="pill">Pinball</span>
                        <span className="pill">Pizza</span>
                        <span className="pill">Piano</span>
                        <span className="pill">Pixels &amp; Processors</span>
                        <span className="pill">Pee&nbsp;Doctor</span>
                    </div>
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
                  </div>
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
    </p>
</section>

<footer>
    <p>&copy; 2025 Peter Liu. Built with caffeine and curiosity.</p>
</footer>
</main>
</>
);
};

export default App;
