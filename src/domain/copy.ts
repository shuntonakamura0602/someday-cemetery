/** Canonical English product copy. Keep repeated actions here so the UI stays consistent. */
export const copy = {
  "app.name": "Someday Cemetery",
  "home.tagline": "A resting place for unfinished things.",
  "home.description":
    "The app you never shipped. The novel you never finished. The plans you quietly outgrew.",
  "home.instruction":
    "Choose a spot, write a few parting words, and lay it to rest.",
  "action.create": "Lay something to rest",
  "action.explore": "Explore the cemetery",
  "action.random": "Visit a random grave",
  "action.list": "List view",
  "action.map": "Map view",
  "action.myGraves": "My graves",
  "plot.choose": "Choose a resting place",
  "form.title": "Project name",
  "form.epitaph": "A few parting words, optional",
  "form.started": "Started, optional",
  "form.publicNotice": "Your title and parting words will be public.",
  "form.submit": "Lay it to rest",
  "form.saving": "Finding it a place…",
  "grave.created": "Your project has a place here.",
  "flower.action": "Leave a flower",
  "flower.done": "Flower left",
  "share.public": "Copy public link",
  "share.image": "Download image",
  "share.copied": "Link copied",
  "recovery.save": "Save your private recovery link",
  "recovery.warning":
    "Anyone with this link can take over editing this grave. Keep it private.",
  "recovery.explanation":
    "Save this link to edit your grave on another device. If you lose both this link and your browser session, we can’t restore access.",
  "recovery.action": "Restore editing access",
  "recovery.success": "Editing access restored. Save your new recovery link.",
  "recovery.invalid": "This recovery link is invalid or has been replaced.",
  "upgrade.title": "Customize this headstone",
  "upgrade.price": "US$7, one time, for this grave",
  "upgrade.tax": "Taxes may apply at checkout.",
  "upgrade.buy": "Unlock all 3 designs",
  "upgrade.download": "Download high-resolution image",
  "payment.pending": "Your payment is being confirmed.",
  "payment.done": "Your custom headstone is ready.",
  "payment.check": "Check again",
  "payment.cancel": "Your grave is still here. You can customize it anytime.",
  "error.plotTaken":
    "Someone else took this plot. Your draft is safe. Choose another spot.",
  "error.unavailable": "This grave isn’t available.",
  "error.network": "Something went wrong. Your draft is safe. Please try again.",
  "error.rateLimit": "Please wait a little before trying again.",
  "error.version": "This grave has changed. Review the latest version before saving.",
  "report.action": "Report this grave",
  "report.success": "Report received. Thank you.",
  "delete.action": "Delete this grave",
  "delete.confirm":
    "Delete this grave? Its text and images will be removed from this site. This cannot be undone.",
  "example.badge": "Example",
  "demo.badge": "Demo — changes stay in this browser",
  "garden.empty": "No graves are resting in this garden yet.",
  "grave.buried": "Laid to rest",
  "grave.started": "Started",
  "grave.location": "Resting in",
  "navigation.home": "Cemetery home",
  "navigation.about": "About",
  "navigation.guidelines": "Guidelines",
  "navigation.privacy": "Privacy",
  "navigation.terms": "Terms",
  "navigation.support": "Support",
  "owner.edit": "Edit this grave",
  "owner.recovery": "Create a new recovery link",
  "owner.none": "You have not laid anything to rest in this browser yet.",
  "checkout.disabled": "Purchases are not available in this environment.",
} as const;

export type CopyKey = keyof typeof copy;

export function t(key: CopyKey): (typeof copy)[CopyKey] {
  return copy[key];
}
