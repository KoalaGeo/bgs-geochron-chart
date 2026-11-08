<script setup lang="ts">
import type { BgsTab } from './BgsHeader.vue'

const emit = defineEmits<{
  (e: 'selectTab', tab: BgsTab): void
}>()

const base = useRuntimeConfig().app.baseURL
const year = new Date().getFullYear()
</script>

<template>
  <!-- Layout follows the BGS www-apps footer include: UKRI/NERC band, link
       columns, then the UKRI copyright line. -->
  <footer class="bgs-site-footer no-print">
    <div class="bgs-footer-ukri">
      <a href="https://www.ukri.org/councils/nerc/" target="_blank" rel="noopener">
        <img
          :src="`${base}images/bgs/nerc_ukri_logo.svg`"
          alt="UKRI Natural Environment Research Council logo"
          width="300"
          height="107"
        >
      </a>
    </div>

    <div class="bgs-footer-links">
      <section>
        <h2>This site</h2>
        <ul>
          <li><a href="?tab=geochron" @click.prevent="emit('selectTab', 'geochron')">Geochronological Chart</a></li>
          <li><a href="?tab=lexicon" @click.prevent="emit('selectTab', 'lexicon')">Lexicon</a></li>
          <li><a href="?tab=browse" @click.prevent="emit('selectTab', 'browse')">Browse all units</a></li>
          <li><a href="?tab=rcs" @click.prevent="emit('selectTab', 'rcs')">Rock Classification Scheme</a></li>
          <li><a href="?tab=about" @click.prevent="emit('selectTab', 'about')">About the data</a></li>
        </ul>
      </section>
      <section>
        <h2>Useful links</h2>
        <ul>
          <li><a href="https://www.bgs.ac.uk/technologies/the-bgs-lexicon-of-named-rock-units/">About the Lexicon</a></li>
          <li><a href="https://www.bgs.ac.uk/technologies/bgs-rock-classification-scheme/">About the RCS</a></li>
          <li><a href="https://www.bgs.ac.uk/about-bgs/">About BGS</a></li>
          <li><a href="https://www.bgs.ac.uk/news/">News and Events</a></li>
          <li><a href="https://www.bgs.ac.uk/about-bgs/contact-us/">Contact us</a></li>
        </ul>
      </section>
      <section>
        <h2>Policies &amp; legal</h2>
        <ul>
          <li><a href="https://www.bgs.ac.uk/legal-and-policy/privacy/">Privacy policy</a></li>
          <li><a href="https://www.bgs.ac.uk/legal-and-policy/cookies-policy/">Cookies policy</a></li>
          <li><a href="https://www.bgs.ac.uk/legal-and-policy/terms-of-use/">Terms of use</a></li>
          <li><a href="https://www.bgs.ac.uk/legal-and-policy/accessibility/">Accessibility statement</a></li>
          <li><a href="https://www.bgs.ac.uk/about-bgs/contact-us/freedom-of-information-act/">Freedom of information (FOI)</a></li>
          <li><a href="https://www.bgs.ac.uk/bgs-intellectual-property-rights/">Intellectual Property Rights</a></li>
        </ul>
      </section>
    </div>

    <div class="bgs-footer-credits">
      <p>
        Built from the
        <a href="https://github.com/BritishGeologicalSurvey/vocabularies" target="_blank" rel="noreferrer">BGS vocabularies</a>
        (Geochronology, Lexicon of Named Rock Units &amp; Rock Classification Scheme).
        Linked data at <a href="https://data.bgs.ac.uk/" target="_blank" rel="noreferrer">data.bgs.ac.uk</a>.
      </p>
      <p>
        Chart structure, ordering and GSSP/GSSA ratification from the
        <a href="https://stratigraphy.org/chart" target="_blank" rel="noreferrer">International Chronostratigraphic Chart</a>
        © International Commission on Stratigraphy, used under
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.
        Chart software adapted from
        <a href="https://github.com/i-c-stratigraphy/chart" target="_blank" rel="noreferrer">i-c-stratigraphy/chart</a>.
      </p>
    </div>

    <div class="bgs-footer-copy">
      <p><a href="https://www.ukri.org/councils/nerc/" target="_blank" rel="noopener">&copy; UKRI {{ year }}</a></p>
    </div>
  </footer>
</template>

<style scoped>
.bgs-site-footer {
  margin-top: auto;
  background: var(--bgs-blue);
  color: var(--bgs-white);
  font-family: var(--bgs-font);
}

.bgs-site-footer a {
  color: var(--bgs-white);
  text-decoration: none;
}

.bgs-site-footer a:hover {
  text-decoration: underline;
}

.bgs-site-footer a:focus-visible {
  outline: 3px solid var(--bgs-lt-ochre);
  outline-offset: 2px;
}

.bgs-footer-ukri {
  background: var(--bgs-dk-gray);
  text-align: center;
  padding: 0 16px;
}

.bgs-footer-ukri img {
  display: inline-block;
  vertical-align: middle;
  width: 300px;
  max-width: 100%;
  height: auto;
}

.bgs-footer-links {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16em, 1fr));
  gap: 8px 32px;
}

.bgs-footer-links h2 {
  margin: 5px 0;
  padding: 5px 0;
  border-bottom: 1px solid var(--bgs-white);
  color: var(--bgs-white);
  font-size: 1.2rem;
  font-weight: 700;
}

.bgs-footer-links ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bgs-footer-links li {
  padding: 5px 0;
}

/* Inline links in running text keep an underline (WCAG 1.4.1). */
.bgs-footer-credits {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  padding: 0 16px 12px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.bgs-footer-credits p {
  margin: 0 0 0.6em;
}

.bgs-footer-credits a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.bgs-footer-credits a:hover {
  text-decoration-color: var(--bgs-lt-ochre);
  text-decoration-thickness: 2px;
}

.bgs-footer-copy {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  border-top: 1px solid var(--bgs-white);
  padding: 10px 16px 15px;
}

.bgs-footer-copy p {
  margin: 0;
}
</style>
