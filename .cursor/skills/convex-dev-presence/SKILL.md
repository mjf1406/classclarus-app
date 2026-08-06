---
name: convex-dev-presence
description: A Convex component for managing presence functionality, i.e., a live-updating list of users in a "room" including their status for when they were last online. Use this skill whenever working with Presence or related Convex component functionality.
version: 0.4.0
---

> Agents: read this skill fully before writing code that uses Presence. Follow the installation and configuration steps exactly.

# Presence

## Instructions

This component provides real-time user presence tracking for rooms or spaces in your application. It efficiently manages who's online, when users were last active, and handles join/leave events without polling or constant query re-execution. The implementation uses Convex scheduled functions to minimize unnecessary updates and includes React hooks for seamless client integration.

### Installation

```bash
npm install @convex-dev/presence
```

Current npm version: `@convex-dev/presence@0.4.0`

## Use cases

- **Building collaborative editors** where you need to show which users are currently viewing or editing a document in real-time
- **Creating chat applications** that display online status indicators and active participant lists for channels or direct messages
- **Implementing multiplayer games** where you track which players are currently in a game room or lobby
- **Adding social features to content platforms** like showing who's currently viewing a live stream, article, or product page
- **Building virtual event platforms** that need to display attendee counts and participant lists for different rooms or sessions

## How it works

The component uses a `Presence` class that wraps Convex scheduled functions to efficiently track user activity. You expose three main functions: `heartbeat` for clients to signal they're active, `list` to query current presence data, and `disconnect` for graceful cleanup when users leave.

Clients use the `usePresence` React hook which automatically sends heartbeat messages at regular intervals and handles cleanup when components unmount or tabs close. The hook takes your presence API, a room identifier, and user information, returning live presence state that updates when users join or leave.

The component includes a basic `FacePile` component for displaying user avatars, but you can use the `usePresence` hook directly to build custom UI. Additional functions like `listUser` let you check if specific users are online across any room. React Native support is available through a separate import path.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by Presence is not needed

## Resources

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Fpresence)
- [GitHub repository](https://github.com/get-convex/presence)
- [Convex Components Directory](https://www.convex.dev/components/presence)
- [Convex documentation](https://docs.convex.dev)
