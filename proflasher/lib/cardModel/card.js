// @ts-nocheck

// This script is injected many times into the same page, so globals must use var
var voicePreferences = {
    fr: ["Thomas"],
    zh: [],
    jp: ["Kyoko"],
    de: ["Reed", "Anna"],
};
var fullLangs = {
    fr: "fr-FR",
    zh: "zh-CN",
    jp: "ja-JP",
    de: "de-DE",
};
var langRates = {
    fr: [1.0, 0.75],
    zh: [0.75, 0.5],
    jp: [0.75, 0.5],
    de: [1.0, 0.75],
};

function debugLog() {
    try {
        let debugOutput = document.getElementById("debugOutput");
        if (!debugOutput) {
            debugOutput = document.createElement("div");
            debugOutput.id = "debugOutput";
            document.querySelector(".card")?.appendChild(debugOutput);
        }
        const el = document.createElement("p");
        const text = Array.from(arguments)
            .map((val) => {
                try {
                    return JSON.stringify(val);
                } catch (e) {
                    return String(val);
                }
            })
            .join("; ");
        el.innerText = text;
        debugOutput.appendChild(el);
    } catch (err) {
        document.write(String(err));
    }
}

function debugVoiceChooser(cardEl, lang) {
    let debugSpeech = cardEl.querySelector("#debugSpeech");
    if (!debugSpeech) {
        debugSpeech = document.createElement("div");
        debugSpeech.id = "debugSpeech";
        cardEl.appendChild(debugSpeech);
    }
    let voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith(fullLangs[lang]));
    if (voices.length === 0) {
        debugLog(`No voices found for ${lang}`);
        voices = window.speechSynthesis.getVoices();
    }
    for (const voice of voices) {
        const text = window.cardStorage.lastWord;
        const el = document.createElement("button");
        el.innerText = `${voice.lang} ${voice.name}`;
        el.addEventListener("click", () => {
            speechSynthesis.cancel();
            speechSynthesis.speak(
                Object.assign(new SpeechSynthesisUtterance(text), {
                    //rate: 0.75,
                    // lang: fullLangs[lang],
                    voice,
                }),
            );
        });
        $$("#debugSpeech")[0].append(el);
    }
}

function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

(() => {
    // From https://github.com/hyperhype/hyperscript/blob/master/index.js
    const w = window;
    const document = w.document;
    const Text = w.Text;

    function context() {
        const cleanupFuncs = [];

        function h() {
            const args = [].slice.call(arguments);
            let e = null;
            function item(l) {
                let r;
                function parseClass(string) {
                    // Our minimal parser doesn't understand escaping CSS special
                    // characters like \`#\`. Don't use them. More reading:
                    // https://mathiasbynens.be/notes/css-escapes .

                    const m = Array.from(string.matchAll(/([\\.#]?[^\\s#.]+)/g)).map((match) => match[0]);
                    if (/^\\.|#/.test(m[0])) e = document.createElement("div");
                    forEach(m, (v) => {
                        const s = v.substring(1, v.length);
                        if (!v) return;
                        if (!e) e = document.createElement(v);
                        else if (v[0] === ".") e.classList.add(s);
                        else if (v[0] === "#") e.setAttribute("id", s);
                    });
                }

                if (l == null);
                else if ("string" === typeof l) {
                    if (!e) parseClass(l);
                    else e.appendChild((r = document.createTextNode(l)));
                } else if (
                    "number" === typeof l ||
                    "boolean" === typeof l ||
                    l instanceof Date ||
                    l instanceof RegExp
                ) {
                    e.appendChild((r = document.createTextNode(l.toString())));
                }
                //there might be a better way to handle this...
                else if (isArray(l)) forEach(l, item);
                else if (isNode(l)) e.appendChild((r = l));
                else if (l instanceof Text) e.appendChild((r = l));
                else if ("object" === typeof l) {
                    for (const k in l) {
                        if ("function" === typeof l[k]) {
                            if (/^on\\w+/.test(k)) {
                                ((k, l) => {
                                    // capture k, l in the closure
                                    if (e.addEventListener) {
                                        e.addEventListener(k.substring(2), l[k], false);
                                        cleanupFuncs.push(() => {
                                            e.removeEventListener(k.substring(2), l[k], false);
                                        });
                                    } else {
                                        e.attachEvent(k, l[k]);
                                        cleanupFuncs.push(() => {
                                            e.detachEvent(k, l[k]);
                                        });
                                    }
                                })(k, l);
                            } else {
                                // observable
                                e[k] = l[k]();
                                cleanupFuncs.push(
                                    l[k]((v) => {
                                        e[k] = v;
                                    }),
                                );
                            }
                        } else if (k === "style") {
                            if ("string" === typeof l[k]) {
                                e.style.cssText = l[k];
                            } else {
                                for (const s in l[k])
                                    ((s, v) => {
                                        if ("function" === typeof v) {
                                            // observable
                                            e.style.setProperty(s, v());
                                            cleanupFuncs.push(
                                                v((val) => {
                                                    e.style.setProperty(s, val);
                                                }),
                                            );
                                        } else {
                                            const match = l[k][s].match(/(.*)\\W+!important\\W*$/);
                                            if (match) {
                                                e.style.setProperty(s, match[1], "important");
                                            } else {
                                                e.style.setProperty(s, l[k][s]);
                                            }
                                        }
                                    })(s, l[k][s]);
                            }
                        } else if (k === "attrs") {
                            for (const v in l[k]) {
                                e.setAttribute(v, l[k][v]);
                            }
                        } else if (k.substr(0, 5) === "data-") {
                            e.setAttribute(k, l[k]);
                        } else {
                            e[k] = l[k];
                        }
                    }
                } else if ("function" === typeof l) {
                    //assume it's an observable!
                    const v = l();
                    e.appendChild((r = isNode(v) ? v : document.createTextNode(v)));

                    cleanupFuncs.push(
                        l((v) => {
                            if (isNode(v) && r.parentElement) r.parentElement.replaceChild(v, r), (r = v);
                            else r.textContent = v;
                        }),
                    );
                }

                return r;
            }
            while (args.length) item(args.shift());

            return e;
        }

        h.cleanup = () => {
            for (let i = 0; i < cleanupFuncs.length; i++) {
                cleanupFuncs[i]();
            }
            cleanupFuncs.length = 0;
        };

        return h;
    }

    window.h = context();
    h.context = context;

    function isNode(el) {
        return el?.nodeName && el.nodeType;
    }

    function forEach(arr, fn) {
        if (arr.forEach) return arr.forEach(fn);
        for (let i = 0; i < arr.length; i++) fn(arr[i], i);
    }

    function isArray(arr) {
        return Object.prototype.toString.call(arr) === "[object Array]";
    }
})();

function speak(event) {
    let el;
    if ("stopPropagation" in event) {
        el = event.target;
        event.stopPropagation();
    } else {
        el = event;
    }
    if (el.classList.contains("speakchild")) {
        el = el.querySelector(".speakme");
    }
    const lang = cardStorage.lang;
    const voice = cardStorage.voice;
    let word = el.getAttribute("data-speak") || el.innerText;
    if (!word || word === "__") {
        return;
    }
    word = word.replace(/\([^)]+\)/g, " ").replace(/\//g, " ");
    const speech = new SpeechSynthesisUtterance(word);
    speech.text = word;
    speech.voice = voice;
    speech.lang = fullLangs[lang];
    speech.volume = 0.75;
    speech.rate = word !== cardStorage.lastWord ? langRates[lang][0] : langRates[lang][1]; // 0.1 to 9
    cardStorage.lastWord = word === cardStorage.lastWord ? null : word;
    speechSynthesis.cancel();
    speechSynthesis.speak(speech);
}

function runSpeech(cardEl, cardStorage, lang, isBack) {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang === fullLangs[lang]);
    cardStorage.voice = voices.find((v) => (voicePreferences[lang] || []).includes(v.name)) || voices[0];

    const speakableElements = $$(".speak,.speakme,.speaknow,.speakchild,[data-speak]");
    speakableElements.forEach((el) => el.addEventListener("click", speak));
    // WORKAROUND: iPhone needs onclick attribute to know the element should handle clicks instead of taps
    speakableElements.forEach((el) => {
        el.setAttribute("onclick", "");
    });

    let selector;
    if (isBack) {
        speechSynthesis.cancel();
        selector = ".speaknow.response,.speakback";
    } else {
        selector = ".speaknow.prompt";
    }
    setTimeout(() => {
        $$(selector).forEach((el) => speak(el));
    }, 10);
}

function initCardOptions(cardEl, cardStorage) {
    cardStorage.fieldGroups = [];
    cardStorage.selectedIndices = {};
    cardStorage.fieldData = {};

    // Get array groups from the hidden card data
    const hiddenCardData = cardEl.querySelector(".hiddenCardData");
    const fieldGroupsAttr = hiddenCardData.getAttribute("data-field-groups");
    const fieldLangsAttr = hiddenCardData.getAttribute("data-field-langs");
    cardStorage.fieldGroups = JSON.parse(fieldGroupsAttr || "[]");
    cardStorage.fieldLangs = JSON.parse(fieldLangsAttr || "{}");

    // Process each field group
    cardStorage.fieldGroups.forEach((group, groupIndex) => {
        const isDisplayed = group.some((f) => cardEl.querySelector(`[data-field-display="${f}"]`));

        for (const f of group) {
            cardStorage.fieldData[f] = hiddenCardData
                .querySelector(`[data-field-data="${f}"]`)
                .textContent.split(";")
                .map((item) => item.trim());
        }

        const itemCount = cardStorage.fieldData[group[0]].length;

        let selectedIndex = null;
        if (isDisplayed) {
            selectedIndex = Math.floor(Math.random() * itemCount);
            cardStorage.selectedIndices[groupIndex] = selectedIndex;
        }
    });
}

function runCardOptions(cardEl, cardStorage, lang, isBack) {
    // Update visible fields with selected indices
    cardStorage.fieldGroups.forEach((group, groupIndex) => {
        const selectedIndex = cardStorage.selectedIndices[groupIndex];
        if (selectedIndex === undefined) return;
        // Update visible fields in the DOM
        group.forEach((field) => {
            if (cardStorage.fieldData[field]) {
                const fieldValues = cardStorage.fieldData[field];
                const selectedValue = fieldValues[selectedIndex] || "";

                // Find all elements in the card that display this field
                $$(`[data-field-display="${field}"]`, cardEl).forEach((el) => {
                    // If it's a response field and we're on the front, render placeholder
                    if (el.classList.contains("response") && !isBack) {
                        el.textContent = "__";
                    } else {
                        el.textContent = selectedValue;
                    }
                });
            }
        });
    });

    // Render tables
    const backDataEl = cardEl.querySelector(".backData");
    $$(".field-group-table", backDataEl).forEach((el) => el.remove());
    cardStorage.fieldGroups.forEach((group, groupIndex) => {
        const itemCount = cardStorage.fieldData[group[0]].length;
        const rows = [];
        for (let i = 0; i < itemCount; i++) {
            if (i === cardStorage.selectedIndices[groupIndex]) {
                continue;
            }
            const tds = [];
            group.forEach((field) => {
                const value = cardStorage.fieldData[field][i];
                const lang = cardStorage.fieldLangs[field];
                const isTargetLang = lang !== "en";
                tds.push(h("td", { lang, className: isTargetLang ? "speakme" : "" }, value));
            });
            rows.push(h("tr", { className: "speakchild" }, ...tds));
        }
        console.log({ group, itemCount, rows });

        backDataEl.appendChild(h("table.field-group-table", rows));
    });
}

function initMixUp(cardStorage) {
    cardStorage.itemOrder = {};
    $$(".mixup").forEach((mixup, mixupIdx) => {
        const itemOrder = (cardStorage.itemOrder[mixupIdx] = []);
        const remaining = [...$$(".mixitem", mixup).keys()];
        while (remaining.length > 0) {
            const idx = (Math.random() * remaining.length) | 0;
            itemOrder.push(...remaining.splice(idx, 1));
        }
    });
}

function runMixUp(cardStorage) {
    $$(".mixup").forEach((mixup, mixupIdx) => {
        const itemOrder = cardStorage.itemOrder[mixupIdx];
        const items = $$(".mixitem", mixup);
        const itemParents = items.map((node) => node.parentElement);
        items.forEach((node) => node.remove());

        itemOrder.forEach((srcIdx, dstIdx) => {
            itemParents[dstIdx].append(items[srcIdx]);
        });
    });
}

function initialize(cardEl, lang) {
    window.cardStorage = { lang };
    document.onerror = debugLog;
    if (document.getElementById("debugOutput")) {
        document.getElementById("debugOutput").remove();
    }
    if (cardEl.querySelector("[data-debug-voice-chooser]")) {
        debugVoiceChooser(cardEl, lang);
    }
    initCardOptions(cardEl, window.cardStorage);
    initMixUp(window.cardStorage);
    console.log(window.cardStorage);
}

function runFront() {
    const cardEl = document.querySelector(".bsp-card");
    const lang = cardEl.getAttribute("data-lang");
    const isBack = false;
    initialize(cardEl, lang);
    const cardStorage = window.cardStorage;

    runCardOptions(cardEl, cardStorage, lang, isBack);
    runMixUp(cardStorage);
    runSpeech(cardEl, cardStorage, lang, isBack);
}

function runBack() {
    const cardEl = document.querySelector(".bsp-card");
    const lang = cardEl.getAttribute("data-lang");
    const isBack = true;
    const cardStorage = window.cardStorage;

    if (cardEl.querySelector("[data-debug-voice-chooser]")) {
        debugVoiceChooser(cardEl, lang);
    }
    runCardOptions(cardEl, cardStorage, lang, isBack);
    runMixUp(cardStorage);
    runSpeech(cardEl, cardStorage, lang, isBack);
}
