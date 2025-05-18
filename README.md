# Proflasher: AI-Powered Language Learning Flashcard Generator

![](docs/logo.png)
## Project Overview

Proflasher aims to create language-specific Anki flashcards augmented with rich, AI-generated, level-appropriate information.

This is bundled with a rich card template, with the following features:
* Random choice from a selection of options for fields (e.g. cycling between verb forms or sentences)
* Reference tables
* Automatic and manual text-to-speech

It's still in very rough early development, but is usable.

## Requirements

* [Node.js](https://nodejs.org/en/download)
* [Anki](https://apps.ankiweb.net/)
* [AnkiConnect](https://ankiweb.net/shared/info/2055492159)


## Setup

In a terminal, navigate to the directory you wish to install it into and clone the repository:

```bash
cd ~/Documents/
git clone https://github.com/LachlanStuart/proflasher.git
cd proflasher
```

Make copies of the example config file and example data directory.

```bash
cp proflasher/.env.example proflasher/.env
cp -R data.example data
```

You need to add a value for `LLM_API_KEY` to `proflasher/.env` to access Google Gemini. To get the key:
1. Go to [AI Studio](https://aistudio.google.com)
2. In the top right, click "Get API Key"
3. Click "+ Create API Key"
4. Hope it works
5. Copy the key it gives you into the `proflasher/.env` file.

