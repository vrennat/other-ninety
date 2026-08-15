# Other Ninety Pi Adapter

Portable Pi agents, extensions, prompts, skills, themes, and configuration for other-ninety.

This adapter contains public defaults only. Add provider credentials and model choices through local Pi configuration rather than this directory. Third-party Pi packages are pinned to the versions used during verification.

The installer loads this adapter from the monorepo; it is not a standalone `pi install` package. Auto-title uses the active model by default. Set both `OTHER_NINETY_TITLE_PROVIDER` and `OTHER_NINETY_TITLE_MODEL` to use a dedicated model. Set `OTHER_NINETY_VISION_PROVIDER` and `OTHER_NINETY_VISION_MODEL` to enable the optional image-analysis tool for text-only sessions.
