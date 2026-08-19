# The Other Ninety for Pi

The complete o90 Pi surface: agents, extensions, prompts, skills, themes, and pinned package configuration.

This directory contains public defaults only. Provider credentials, model choices, sessions, trust decisions, and OAuth state stay in local Pi configuration. The root bootstrap installs its locked Bun dependencies and configured Pi packages; this directory is not a standalone Pi package.

Auto-title uses the active model by default. Set both `OTHER_NINETY_TITLE_PROVIDER` and `OTHER_NINETY_TITLE_MODEL` to use a dedicated model. Set `OTHER_NINETY_VISION_PROVIDER` and `OTHER_NINETY_VISION_MODEL` to enable optional image analysis for text-only sessions.

The Pi UI shows elapsed turn time, context and cache use, and MCP status only
when a server needs attention. Use `/effort` to select a supported reasoning
level and `/clear` to start a fresh session.
