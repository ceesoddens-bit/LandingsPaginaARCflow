/**
 * ARC FLOW — Ultra-Performance Parallax & Motion Engine
 * Inspired by EventBeds.com multi-plane interactions, Webflow 3D transforms & sticky pinning
 * Architecture: 60-120fps RAF Loop with Lerp, Zero Layout Thrashing & Automatic Sleep State
 */

class ArcMotionEngine {
    constructor() {
        this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isMobile = window.innerWidth < 1024;

        // Smooth scroll state
        this.scroll = {
            target: window.scrollY || window.pageYOffset,
            current: window.scrollY || window.pageYOffset,
            ease: 0.085,
            isScrolling: false
        };

        // Smooth mouse parallax state (hero 3D depth)
        this.mouse = {
            targetX: 0,
            targetY: 0,
            currentX: 0,
            currentY: 0,
            ease: 0.05,
            isHoveringHero: false
        };

        this.rafId = null;
        this.isLoopActive = false;

        // Elements registry
        this.parallaxElements = [];
        this.cardPaths = [];
        this.heroPins = [];
        this.heroVideo = null;
        this.heroContainer = null;

        // Sticky process flow elements
        this.stickyContainer = null;
        this.stickyCards = [];
        this.stepPills = [];
        this.progressBar = null;

        this.init();
    }

    init() {
        if (this.isReducedMotion) {
            console.info('[ArcMotion] prefers-reduced-motion detected: Parallax disabled.');
            this.initWidgets();
            return;
        }

        this.cacheElements();
        this.bindEvents();
        this.initStickyProcess();
        this.initWidgets();
        this.requestTick();
    }

    cacheElements() {
        // 1. Scroll parallax elements
        const elements = document.querySelectorAll('[data-parallax-speed]');
        this.parallaxElements = Array.from(elements).map(el => {
            const speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0;
            const direction = el.getAttribute('data-parallax-dir') || 'y';
            const rotate = parseFloat(el.getAttribute('data-parallax-rotate')) || 0;
            return { el, speed, direction, rotate };
        });

        // 2. Diagonal Card Paths (EventBeds card-path-block)
        const paths = document.querySelectorAll('.card-path-track, .photo-path-track');
        this.cardPaths = Array.from(paths).map(track => {
            const speed = parseFloat(track.getAttribute('data-path-speed')) || 0.15;
            const direction = track.getAttribute('data-path-dir') === 'left' ? -1 : 1;
            const baseAngle = parseFloat(track.getAttribute('data-path-angle')) || 0;
            return { track, speed, direction, baseAngle };
        });

        // 3. Hero elements for Mouse Parallax
        this.heroContainer = document.getElementById('hero');
        this.heroPins = document.querySelectorAll('[data-mouse-depth]');
        this.heroVideo = document.querySelector('#hero video');
    }

    bindEvents() {
        // Passive scroll listener: updates target position
        window.addEventListener('scroll', () => {
            this.scroll.target = window.scrollY || window.pageYOffset;
            this.requestTick();
        }, { passive: true });

        // Hero mouse move (desktop only)
        if (!this.isTouch && this.heroContainer) {
            this.heroContainer.addEventListener('pointerenter', () => {
                this.mouse.isHoveringHero = true;
                this.requestTick();
            });

            this.heroContainer.addEventListener('pointerleave', () => {
                this.mouse.isHoveringHero = false;
                this.mouse.targetX = 0;
                this.mouse.targetY = 0;
                this.requestTick();
            });

            this.heroContainer.addEventListener('pointermove', (e) => {
                const rect = this.heroContainer.getBoundingClientRect();
                const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                this.mouse.targetX = Math.max(-1, Math.min(1, nx));
                this.mouse.targetY = Math.max(-1, Math.min(1, ny));
                this.requestTick();
            }, { passive: true });
        }

        // Resize handler
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 1024;
            this.requestTick();
        }, { passive: true });
    }

    requestTick() {
        if (!this.isLoopActive) {
            this.isLoopActive = true;
            this.rafId = requestAnimationFrame(this.render.bind(this));
        }
    }

    lerp(start, end, factor) {
        return (1 - factor) * start + factor * end;
    }

    render() {
        // 1. Lerp Scroll calculation
        const scrollDelta = this.scroll.target - this.scroll.current;
        this.scroll.current = this.lerp(this.scroll.current, this.scroll.target, this.scroll.ease);

        // 2. Lerp Mouse calculation
        const mouseDeltaX = this.mouse.targetX - this.mouse.currentX;
        const mouseDeltaY = this.mouse.targetY - this.mouse.currentY;
        this.mouse.currentX = this.lerp(this.mouse.currentX, this.mouse.targetX, this.mouse.ease);
        this.mouse.currentY = this.lerp(this.mouse.currentY, this.mouse.targetY, this.mouse.ease);

        const isScrollMoving = Math.abs(scrollDelta) > 0.05;
        const isMouseMoving = (Math.abs(mouseDeltaX) > 0.001 || Math.abs(mouseDeltaY) > 0.001);

        // --- Multi-Plane Scroll Parallax ---
        if (isScrollMoving) {
            const vh = window.innerHeight;
            const scrollY = this.scroll.current;

            this.parallaxElements.forEach(({ el, speed, direction, rotate }) => {
                const rect = el.getBoundingClientRect();
                if (rect.bottom >= -150 && rect.top <= vh + 150) {
                    const relativeOffset = (scrollY - (rect.top + scrollY - vh * 0.5)) * speed;
                    if (direction === 'y') {
                        el.style.transform = `translate3d(0, ${relativeOffset.toFixed(2)}px, 0) rotate(${rotate}deg)`;
                    } else if (direction === 'x') {
                        el.style.transform = `translate3d(${relativeOffset.toFixed(2)}px, 0, 0) rotate(${rotate}deg)`;
                    }
                }
            });

            // --- Diagonal Marquee / Card Paths ---
            this.cardPaths.forEach(({ track, speed, direction, baseAngle }) => {
                const rect = track.parentElement ? track.parentElement.getBoundingClientRect() : null;
                if (!rect || (rect.bottom >= -200 && rect.top <= vh + 200)) {
                    const offset = scrollY * speed * direction;
                    track.style.transform = `rotate(${baseAngle}deg) translate3d(${offset.toFixed(2)}px, 0, 0)`;
                }
            });

            // --- Sticky Process Flow Update ---
            this.updateStickyProcess(scrollY);
        }

        // --- Hero Mouse-Move Parallax ---
        if (!this.isTouch && (isMouseMoving || isScrollMoving)) {
            const mx = this.mouse.currentX;
            const my = this.mouse.currentY;

            // Subtle video shift
            if (this.heroVideo) {
                const vx = (mx * -10).toFixed(2);
                const vy = (my * -8).toFixed(2);
                this.heroVideo.style.transform = `translate3d(calc(-50% + ${vx}px), calc(-50% + ${vy}px), 0) scale(1.05)`;
            }

            // Floating Pins 3D offset
            this.heroPins.forEach(pin => {
                const depth = parseFloat(pin.getAttribute('data-mouse-depth')) || 25;
                const scrollSpeed = parseFloat(pin.getAttribute('data-parallax-speed')) || 0;
                const px = (mx * depth).toFixed(2);
                const py = (my * depth + (this.scroll.current * scrollSpeed)).toFixed(2);
                pin.style.transform = `translate3d(${px}px, ${py}px, 0)`;
            });
        }

        // Check if we can put RAF loop to sleep to save CPU/GPU
        if (isScrollMoving || isMouseMoving || this.mouse.isHoveringHero) {
            this.rafId = requestAnimationFrame(this.render.bind(this));
        } else {
            this.scroll.current = this.scroll.target;
            this.mouse.currentX = this.mouse.targetX;
            this.mouse.currentY = this.mouse.targetY;
            this.isLoopActive = false;
        }
    }

    /* ==========================================================================
       STICKY PROCESS FLOW (Discover / Werkwijze: 01, 02, 03, 04)
       ========================================================================== */
    initStickyProcess() {
        this.stickyContainer = document.getElementById('werkwijze-sticky-container');
        this.stickyCards = document.querySelectorAll('.process-step-card');
        this.stepPills = document.querySelectorAll('.process-step-indicator');
        this.progressBar = document.getElementById('process-progress-bar');
    }

    updateStickyProcess(scrollY) {
        if (!this.stickyContainer || this.isMobile) return;

        const rect = this.stickyContainer.getBoundingClientRect();
        const totalScroll = this.stickyContainer.offsetHeight - window.innerHeight;
        
        if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
            const progress = Math.min(Math.max(-rect.top / totalScroll, 0), 1);
            
            const totalSteps = this.stickyCards.length;
            if (totalSteps === 0) return;

            const currentStepFloat = progress * totalSteps;
            const activeIndex = Math.min(totalSteps - 1, Math.floor(currentStepFloat));
            const subProgress = currentStepFloat - activeIndex;

            // Update Progress Bar
            if (this.progressBar) {
                this.progressBar.style.height = `${(progress * 100).toFixed(1)}%`;
            }

            // Update Left-Hand Step Indicators
            this.stepPills.forEach((pill, idx) => {
                if (idx === activeIndex) {
                    pill.classList.add('step-active');
                } else {
                    pill.classList.remove('step-active');
                }
            });

            // Card Deck Transform (3D Layering & Scaling)
            this.stickyCards.forEach((card, idx) => {
                if (idx < activeIndex) {
                    // Passed cards
                    card.style.transform = `translate3d(0, -115%, 0) scale(0.92) rotateX(8deg)`;
                    card.style.opacity = '0';
                    card.style.pointerEvents = 'none';
                } else if (idx === activeIndex) {
                    // Active card
                    const scale = 1 - (subProgress * 0.04);
                    card.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(3)})`;
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                } else if (idx === activeIndex + 1) {
                    // Next card entering
                    const translateY = (100 - (subProgress * 100)).toFixed(1);
                    card.style.transform = `translate3d(0, ${translateY}%, 0) scale(0.96)`;
                    card.style.opacity = subProgress.toFixed(2);
                    card.style.pointerEvents = 'none';
                } else {
                    // Future cards
                    card.style.transform = `translate3d(0, 110%, 0)`;
                    card.style.opacity = '0';
                    card.style.pointerEvents = 'none';
                }
            });
        }
    }

    /* ==========================================================================
       INTERACTIVE WIDGETS (ROI Calculator, FAQ, Word Reveal, Form)
       ========================================================================== */
    initWidgets() {
        // 1. Live Header Scroll Morph
        const header = document.getElementById('site-header');
        if (header) {
            window.addEventListener('scroll', () => {
                const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                const isMenuOpen = menuDrawer && menuDrawer.classList.contains('is-open');
                if (scrollY > 50 || isMenuOpen) {
                    header.classList.add('header-scrolled');
                } else {
                    header.classList.remove('header-scrolled');
                }
            }, { passive: true });
        }

        // 1b. Mobile & iPad Menu Drawer Controller
        const menuBtn = document.getElementById('mobile-menu-btn');
        const menuDrawer = document.getElementById('mobile-menu-drawer');
        const mobileLinks = document.querySelectorAll('.mobile-nav-link');

        if (menuBtn && menuDrawer) {
            const setMenuState = (open) => {
                menuDrawer.classList.toggle('is-open', open);
                menuBtn.classList.toggle('menu-open', open);
                menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (header) {
                    if (open) {
                        header.classList.add('header-scrolled');
                    } else if ((window.pageYOffset || document.documentElement.scrollTop) <= 50) {
                        header.classList.remove('header-scrolled');
                    }
                }
            };

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !menuDrawer.classList.contains('is-open');
                setMenuState(willOpen);
            });

            mobileLinks.forEach(link => {
                link.addEventListener('click', () => {
                    setMenuState(false);
                });
            });

            document.addEventListener('click', (e) => {
                if (!menuDrawer.contains(e.target) && !menuBtn.contains(e.target)) {
                    setMenuState(false);
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    setMenuState(false);
                }
            });

            window.addEventListener('resize', () => {
                if (window.innerWidth >= 1024) {
                    setMenuState(false);
                }
            });
        }

        // 2. Word-by-Word Scroll Reveal for Manifesto
        const words = document.querySelectorAll('.word-reveal');
        if (words.length) {
            let ticking = false;
            const checkWordHighlights = () => {
                const vh = window.innerHeight;
                const triggerTop = vh * 0.82;
                words.forEach(word => {
                    const rect = word.getBoundingClientRect();
                    if (rect.top < triggerTop) {
                        word.classList.add('word-active');
                    } else {
                        word.classList.remove('word-active');
                    }
                });
                ticking = false;
            };

            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(checkWordHighlights);
                    ticking = true;
                }
            }, { passive: true });

            checkWordHighlights();
        }

        // 3. Live ROI Besparingscalculator
        const sliderTeam = document.getElementById('slider-team');
        const sliderHours = document.getElementById('slider-hours');
        const labelTeam = document.getElementById('label-team');
        const labelHours = document.getElementById('label-hours');
        const calcEuros = document.getElementById('calc-euros');
        const calcHours = document.getElementById('calc-hours');
        const calcDays = document.getElementById('calc-days');
        const rateButtons = document.querySelectorAll('.rate-btn');

        if (sliderTeam && sliderHours && calcEuros) {
            let currentRate = 55;

            const updateCalculations = () => {
                const team = parseInt(sliderTeam.value, 10);
                const hours = parseInt(sliderHours.value, 10);

                if (labelTeam) labelTeam.textContent = `${team} FTE`;
                if (labelHours) labelHours.textContent = `${hours} uur`;

                const efficiencyFactor = 0.70;
                const monthlyHoursSaved = Math.round(team * hours * 4.33 * efficiencyFactor);
                const yearlyHoursSaved = Math.round(team * hours * 50 * efficiencyFactor);
                const yearlyEuroSaved = Math.round(yearlyHoursSaved * currentRate);
                const yearlyDaysSaved = Math.round(yearlyHoursSaved / 8);

                calcEuros.textContent = yearlyEuroSaved.toLocaleString('nl-NL');
                if (calcHours) calcHours.textContent = monthlyHoursSaved.toLocaleString('nl-NL') + ' u';
                if (calcDays) calcDays.textContent = yearlyDaysSaved.toLocaleString('nl-NL') + ' dgn';
            };

            sliderTeam.addEventListener('input', updateCalculations);
            sliderHours.addEventListener('input', updateCalculations);

            rateButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    rateButtons.forEach(b => {
                        b.classList.remove('active', 'border-teal-500/50', 'bg-arc-teal/30', 'text-white');
                        b.classList.add('border-white/10', 'text-gray-300');
                    });
                    btn.classList.add('active', 'border-teal-500/50', 'bg-arc-teal/30', 'text-white');
                    btn.classList.remove('border-white/10', 'text-gray-300');
                    currentRate = parseInt(btn.getAttribute('data-rate'), 10);
                    updateCalculations();
                });
            });

            updateCalculations();
        }

        // 4. FAQ Accordion
        const faqToggles = document.querySelectorAll('.faq-toggle');
        faqToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const content = toggle.nextElementSibling;
                const icon = toggle.querySelector('.faq-icon');
                const isHidden = content.classList.contains('hidden');

                document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.faq-icon').forEach(i => {
                    i.textContent = '+';
                    i.style.transform = 'rotate(0deg)';
                });

                if (isHidden) {
                    content.classList.remove('hidden');
                    icon.textContent = '−';
                }
            });
        });

        // 5. Formspree Contact Form AJAX
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = new FormData(contactForm);
                try {
                    const response = await fetch(contactForm.action, {
                        method: 'POST',
                        body: data,
                        headers: { 'Accept': 'application/json' }
                    });
                    if (response.ok) {
                        contactForm.style.display = 'none';
                        const successBlock = document.getElementById('contact-form-success');
                        if (successBlock) successBlock.classList.remove('hidden');
                    } else {
                        alert('Er ging iets mis bij het versturen. Probeer het later opnieuw of mail direct naar info@arc-flow.nl.');
                    }
                } catch (error) {
                    alert('Er ging iets mis bij het versturen. Probeer het later opnieuw of mail direct naar info@arc-flow.nl.');
                }
            });
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.arcMotion = new ArcMotionEngine();
});
