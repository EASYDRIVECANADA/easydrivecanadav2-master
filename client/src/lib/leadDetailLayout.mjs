export const leadDetailSectionClasses = ({ stretch = false } = {}) => ({
  section: stretch ? 'flex h-full flex-col' : 'flex flex-col',
  body: `${stretch ? 'flex-1 ' : ''}overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`,
})
