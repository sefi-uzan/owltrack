import type { MDXContent } from 'mdx/types'
import Accuracy from './content/accuracy.mdx'
import Calibration from './content/calibration.mdx'
import HowItWorks from './content/how-it-works.mdx'
import Installation from './content/installation.mdx'
import Introduction from './content/introduction.mdx'
import OverlayPage from './content/overlay.mdx'
import Privacy from './content/privacy.mdx'
import QuickStart from './content/quick-start.mdx'
import SettingsPage from './content/settings.mdx'
import Troubleshooting from './content/troubleshooting.mdx'

export interface Page {
  slug: string
  title: string
  Content: MDXContent
}

export interface Section {
  title: string
  pages: Page[]
}

/** Sidebar order. Pages link to each other as `#/<slug>`. */
export const SECTIONS: Section[] = [
  {
    title: 'Getting started',
    pages: [
      { slug: 'introduction', title: 'Introduction', Content: Introduction },
      { slug: 'installation', title: 'Installation', Content: Installation },
      { slug: 'quick-start', title: 'Quick start', Content: QuickStart }
    ]
  },
  {
    title: 'Using OwlTrack',
    pages: [
      { slug: 'calibration', title: 'Calibration', Content: Calibration },
      { slug: 'overlay', title: 'The overlay', Content: OverlayPage },
      { slug: 'settings', title: 'Settings', Content: SettingsPage }
    ]
  },
  {
    title: 'Under the hood',
    pages: [
      { slug: 'how-it-works', title: 'How it works', Content: HowItWorks },
      { slug: 'accuracy', title: 'Accuracy', Content: Accuracy }
    ]
  },
  {
    title: 'Help',
    pages: [
      { slug: 'troubleshooting', title: 'Troubleshooting', Content: Troubleshooting },
      { slug: 'privacy', title: 'Privacy & security', Content: Privacy }
    ]
  }
]

export const PAGES: Page[] = SECTIONS.flatMap((s) => s.pages)
