// string.extensions.ts

// Augment the global String interface
declare global {
    interface String {
      toTitleCase(): string;
    }
  }
  
  // Add the method to String.prototype
  String.prototype.toTitleCase = function (): string {
    if (!this) {
      return "";
    }
  
    return this.toLowerCase() // Convert to lowercase first for consistent capitalization
      .split(/[\s-]+/) // Split by spaces or hyphens
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
      .join(" "); // Join the words with a space
  };
  
  // Export an empty object to convert this script into a module
  export {};
  