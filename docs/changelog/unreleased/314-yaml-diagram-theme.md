---
section: Fixed
---

- **PlantUML `@startyaml` diagrams follow the site theme (#314).** Before, a
  YAML diagram rendered in PlantUML's default colours, while `@startjson` took
  the theme's node, border, text and arrow colours. Now `@startyaml` gets the
  same style block, so both data trees match the rest of the page's diagrams.
