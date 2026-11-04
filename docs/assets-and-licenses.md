# Assets and licenses

Someday Cemetery does not bundle stock photography, downloaded illustrations, third-party icon packs, audio, or UI web fonts. It bundles one server-only font so generated memorial images can render Japanese reliably on every host.

- The cemetery, trees, paths, pond, lights, gravestones, flowers, lantern, and moon are original application CSS/DOM/SVG shapes in this repository.
- `src/app/icon.svg` is an original project icon created for this implementation.
- Memorial PNGs are generated deterministically from application-owned SVG/layout code and user-provided plain text.
- Browser typography uses the visitor operating system’s serif and system UI font stacks.
- Server-generated memorial PNGs use the unmodified variable font **Noto Sans JP 2.004** (`NotoSansJP-wght.ttf`) by Google and Adobe. It was retrieved from the [official Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/notosansjp), is redistributed under the **SIL Open Font License 1.1**, and is used only while rasterizing memorial text. The license is bundled at [`src/server/images/fonts/OFL.txt`](../src/server/images/fonts/OFL.txt). SHA-256: `c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f`.
- The 12 Example epitaphs come from the supplied Someday Cemetery product specification and are marked **Example** in the map, detail, and image output.

Runtime and development packages retain their own licenses. Exact package versions and integrity hashes are in `package-lock.json`; consult each installed package’s license and upstream source before redistribution. No package license is intended to license user-submitted content.

If another external asset or font is added later, record its creator, source URL, exact license/version, required attribution, modification status, checksum, and where it appears before merging or publishing it.
