/**
 * Automated Quality & Testing Suite - Site Pessoal Mateus Lucena
 * Uses Node.js native test runner (node --test) to perform:
 * 1. Unit testing of EventBus (Mediator Pattern).
 * 2. Static HTML/SEO semantic check.
 * 3. Static CSS Design System token check.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Helper to load main.js in a mocked browser context
function loadApp() {
    const dataCode = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
    const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    
    // Generic mock element to support style settings and class lists
    const createMockElement = () => ({
        addEventListener: () => {},
        dispatchEvent: () => {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        getAttribute: () => '',
        value: '',
        style: {},
        appendChild: () => {},
        insertBefore: () => {},
        firstChild: null,
        innerHTML: ''
    });

    // Minimal mock of DOM APIs required for initialization
    const mockDocument = {
        addEventListener: (event, cb) => {
            if (event === 'DOMContentLoaded') {
                cb(); // Trigger synchronously for testing
            }
        },
        querySelectorAll: (selector) => {
            return [createMockElement()];
        },
        getElementById: (id) => {
            return createMockElement();
        },
        querySelector: (selector) => {
            return createMockElement();
        },
        createElement: (tag) => {
            return createMockElement();
        },
        body: createMockElement()
    };
    
    const mockWindow = {
        location: { hash: '' },
        addEventListener: () => {},
        scrollTo: () => {}
    };

    const context = {
        window: mockWindow,
        document: mockDocument,
        console: {
            log: () => {}, // suppress logs during tests
            error: console.error,
            warn: console.warn
        },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        // Mock Leaflet global variable L to prevent boot errors
        L: {
            map: () => ({
                setView: () => ({
                    on: () => {}
                }),
                on: () => {}
            }),
            icon: () => ({}),
            marker: () => ({
                addTo: () => ({
                    bindPopup: () => ({
                        on: () => {}
                      })
                })
            }),
            polyline: () => ({
                addTo: () => {}
            })
        }
    };

    vm.createContext(context);
    vm.runInContext(dataCode, context);
    vm.runInContext(mainCode, context);
    return context.window.App;
}

// ----------------------------------------------------
// 1. UNIT TESTS: EventBus (Mediator Pattern)
// ----------------------------------------------------
test('EventBus Unit Tests', async (t) => {
    await t.test('Publish-Subscribe flow: Callback should receive correct data', () => {
        const App = loadApp();
        const bus = App.eventBus;
        
        let receivedData = null;
        bus.subscribe('test:event', (data) => {
            receivedData = data;
        });
        
        bus.publish('test:event', { payload: 'success' });
        assert.deepStrictEqual(receivedData, { payload: 'success' });
    });

    await t.test('Multiple subscribers: All callbacks should fire', () => {
        const App = loadApp();
        const bus = App.eventBus;
        
        let counter = 0;
        bus.subscribe('test:multi', () => counter++);
        bus.subscribe('test:multi', () => counter++);
        
        bus.publish('test:multi');
        assert.strictEqual(counter, 2);
    });
});

// ----------------------------------------------------
// 2. STATIC HTML QUALITY & SEO VALIDATION
// ----------------------------------------------------
test('HTML & SEO Semantic Validation', async (t) => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    await t.test('Page title tag must exist and have content', () => {
        const match = htmlContent.match(/<title>(.*?)<\/title>/i);
        assert.ok(match, 'Title tag is missing');
        assert.ok(match[1].trim().length > 0, 'Title tag is empty');
    });

    await t.test('Meta description tag must be present for SEO', () => {
        const hasMetaDesc = /<meta\s+name="description"\s+content="[^"]+"/i.test(htmlContent);
        assert.ok(hasMetaDesc, 'Meta description tag is missing or empty');
    });

    await t.test('HTML must have <h1> tags for optimal SEO hierarchy', () => {
        const h1Matches = htmlContent.match(/<h1[\s>]/g) || [];
        assert.ok(h1Matches.length >= 1, 'No <h1> tags found');
    });
    
    await t.test('Check for duplicate IDs in interactive elements to prevent DOM collisions', () => {
        const idMatches = htmlContent.match(/id="([^"]+)"/g) || [];
        const ids = idMatches.map(m => m.match(/id="([^"]+)"/)[1]);
        const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
        assert.strictEqual(duplicates.length, 0, `Duplicate IDs found: ${duplicates.join(', ')}`);
    });
});

// ----------------------------------------------------
// 3. CSS DESIGN SYSTEM & RESPONSIVE VALIDATION
// ----------------------------------------------------
test('CSS Token Verification', async (t) => {
    const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

    await t.test('CSS should define variable tokens in :root', () => {
        const hasRootVariables = cssContent.includes('--color-primary') && cssContent.includes('--color-accent');
        assert.ok(hasRootVariables, 'CSS variable design tokens are missing in root');
    });

    await t.test('Ensure no legacy menu-toggle.open rules exist that leak hamburger state', () => {
        const hasLegacyToggleActive = cssContent.includes('.menu-toggle.open span');
        assert.ok(!hasLegacyToggleActive, 'Legacy active sandwich rules are still present in CSS');
    });
});
