// File: lib/animations.ts
// Animation utility functions and variants for hive dashboard transitions

export const fadeInFromRight = {
  hidden: { 
    opacity: 0, 
    x: 100,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  exit: { 
    opacity: 0, 
    x: -100,
    scale: 0.95,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export const fadeInFromLeft = {
  hidden: { 
    opacity: 0, 
    x: -100,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  exit: { 
    opacity: 0, 
    x: 100,
    scale: 0.95,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

export const chartCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 50,
    scale: 0.9
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.15,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }),
  exit: {
    opacity: 0,
    y: -50,
    scale: 0.9,
    transition: {
      duration: 0.3
    }
  }
};

export const hiveCircleVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    rotate: -10
  },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1]
    }
  }),
  exit: {
    opacity: 0,
    scale: 0.8,
    rotate: 10,
    transition: {
      duration: 0.3
    }
  }
};

export const backButtonVariants = {
  hidden: { 
    opacity: 0, 
    x: -50
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export const selectedHiveVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.5,
    y: -100
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.34, 1.56, 0.64, 1]
    }
  }
};