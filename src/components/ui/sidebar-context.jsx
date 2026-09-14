import * as React from "react"

/**
 * @typedef {{
 *   state: 'expanded' | 'collapsed',
 *   open: boolean,
 *   setOpen: React.Dispatch<React.SetStateAction<boolean>>,
 *   isMobile: boolean,
 *   openMobile: boolean,
 *   setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>,
 *   toggleSidebar: () => void,
 * }} SidebarContextValue
 */

const SidebarContext = React.createContext(/** @type {SidebarContextValue | null} */ (null))

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

export { SidebarContext, useSidebar }
