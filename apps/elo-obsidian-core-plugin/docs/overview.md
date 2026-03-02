# Elo Obsidian Core Plugin

## Overview
The `elo-obsidian-core-plugin` is the central plugin for the Elocuency framework within Obsidian. It serves as the backbone for AI interactions, note management, and other core functionalities that are shared across different specialized plugins.

## Key Features
- **AI Integration**: Provides services to interact with LLMs (like Gemini) directly from Obsidian.
- **Context Management**: Utilities to extract and manage context from Obsidian notes, including linked files and vocabulary.
- **Quiz Generation**: Generates quizzes based on note content to aid learning and retention.
- **Header Management**: Tools to manage and evaluate note headers and their metadata.

## Testing
This project follows a comprehensive testing strategy based on Hexagonal Architecture principles. See [Testing Strategy](../../../libs/core-ts/docs/testing-strategy.md) for detailed guidelines on:
- What to test (and what to skip)
- Layer-specific testing approaches
- Code examples and patterns
- Coverage targets and priorities


## Usage
This plugin is intended to be used as part of the Elocuency workspace and is not typically installed as a standalone plugin without the accompanying framework dependencies.
