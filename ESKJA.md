# eskja

> to keep.

This file records the design grammar and principles of Eskja. It is not
user-facing documentation and it does not control the application. It
exists so future design and implementation decisions can be checked
against what Eskja is trying to be.

## principles

-   Things are things. Do not force them to become "content," "assets,"
    "files," memories, documents, or categories in the human-facing
    interface.
-   Eskja is a container for things. The container is subordinate to
    what is kept in it.
-   Things acquire meaning through relationship, placement, gathering,
    use, history, and the person who keeps them. Eskja does not
    interpret those relationships for the user.
-   Structure should emerge through use rather than through a
    customization panel.
-   Uncertainty is permitted. Discovery is part of the experience.
    Reliability underneath does not require total explanation on the
    surface.
-   Do not confuse choice with agency.
-   The user determines meaning.
-   Physical things are not made obsolete by digital representations.
-   Keeping is not entombment. Things are kept so they may be
    encountered and brought out again.
-   Mystery should arise from possibility, not arbitrary obstruction.
-   What we keep, keeps us.

## vocabulary

### thing

The basic human-facing concept. A thing may be an image, GIF, recording,
voice memo, text, scan, or another form not yet supported. Eskja does
not need to explain what the thing "really" is.

The word also carries the older sense of a gathering: things placed
together establish relationships without requiring explicit metadata
describing those relationships.

### eskja / eskjur

A box; boxes. An eskja contains things. These terms primarily describe
the design ontology. They do not need to be announced or explained in
the interface.

### storeskja

The largest box: the user's initial/home space. It contains entrances
into eskjur. "storeskja" is useful as an internal design term and does
not need to appear as a UI label.

### shop

The place where things are made. Prefer "shop" to "studio." The intended
sense is workshop/place of making, not contemporary online shopping.

### make

The act of entrusting a digital thing to Eskja Shop to be given a
particular physical existence.

## spatial grammar

### storeskja

-   The user's own storeskja occupies the viewport. The user is inside
    it rather than looking at a framed representation of it.
-   Current direction: black field.
-   It contains entrances into eskjur.
-   Entrances are not folder icons and do not require labels.
-   A photograph, GIF, recording representation, glyph, drawing, or
    piece of text can itself be the entrance.
-   Position is free. Eskjur can be moved spatially rather than forced
    into a grid.
-   Disorder is valid. Eskja must not treat an unorganized storeskja as
    a problem to fix.

### eskja

-   Entering an entrance in storeskja opens the eskja behind it.
-   Current direction: white canvas, providing an immediate but
    unexplained spatial distinction from storeskja.
-   `+` inside an eskja adds a thing; it does not automatically create
    another eskja.
-   `&` inside an eskja adds movable text.
-   Things may be freely positioned, resized, and overlapped.
-   Existing image controls remain contextual and quiet.
-   Text fields do not receive image-only controls such as the
    color/grayscale slider or hourglass aging feature.

### entering and leaving

Entering should feel spatial rather than navigational: the entrance may
expand toward the viewport and resolve into the contained space. Leaving
should reverse that relationship sufficiently for the user to infer: "I
was inside that."

Avoid conventional labels such as `BOARD`, `FOLDER`, `VIEWING`,
breadcrumbs, or explanatory hierarchy diagrams.

## first use

A new account lands in an empty storeskja.

Visible controls are extremely limited:

-   `+` --- bring something in.
-   `&` --- write something.
-   star --- wander/look elsewhere.

When `+` is used from storeskja, the uploaded thing becomes an entrance
into a new eskja.

When `&` is used from storeskja, the resulting text becomes an entrance
into a new eskja. A user who prefers titles/hierarchies can therefore
create them without requiring everyone to do so.

A first-time user must not easily mistake storeskja for the interior of
an eskja. One possible onboarding behavior is for the first uploaded
entrance to appear briefly and then open automatically, teaching the
relationship through motion rather than explanation. This remains an
option, not a settled implementation.

## controls

### `+`

Context-sensitive.

In storeskja: upload/import a thing; that thing becomes an entrance to
an eskja.

Inside an eskja: upload/import a thing into the current eskja.

Intended forms include photographs/images, GIFs, audio, and voice memos
as support is added.

### `&`

In storeskja: text becomes an entrance to an eskja.

Inside an eskja: text becomes a movable thing within the current eskja.

### star

The star means outward/elsewhere rather than help.

Visual direction: a simple star, potentially a four-pointed or
Star-of-Bethlehem-like form with an elongated lower ray. It carries
navigation/orientation associations without requiring explanation.

From storeskja, star takes the user into a shared space belonging to
someone else. While wandering, star again takes the user to another
shared space.

It does not open a feed, directory, popularity ranking, or
recommendation list.

### home

While wandering, home returns directly to the user's own storeskja.

Home and star belong outside the visited person's shared work rather
than being overlaid on it.

## wandering / shared spaces

A person may choose to share an entire storeskja or an individual eskja.

The visitor does not receive a profile page. They encounter the shared
space.

### visual distinction

The user's own storeskja fills the viewport.

A shared storeskja or eskja is visibly bounded and presented within a
larger surrounding field:

-   white surrounding viewport;
-   shared space smaller within it, with generous margins;
-   an appropriate subtle edge/boundary;
-   avoid unnecessary paper texture unless testing shows it adds
    something essential.

The spatial message is: this is someone else's box I am looking through.

### attribution

A sharer may optionally provide: - a name; and/or - a very short note,
roughly gallery-label scale.

Both may be blank.

Attribution appears small and quiet beneath the shared space, analogous
to an artist attribution beside a work in a gallery. It is not a profile
header.

### wandering deliberately does not contain

-   likes
-   comments
-   follows/subscriptions
-   follower counts
-   social view counts
-   DMs attached to discovery
-   engagement ranking
-   recommendation feeds
-   required public profiles
-   indications of private spaces the visitor cannot access

A visitor looks, wanders, wonders, and leaves.

## habitation, not customization

Eskja should not ask a person to express themselves through themes,
palettes, layout presets, or conventional personalization.

Instead, a person's space should gradually bear traces of how that
person keeps things.

Potential structural primitives: - position - size - nesting - gathering

One person may build a strict hierarchy. Another may scatter dozens of
eskjur. Another may use only photographs as entrances. Another may use
letters, numbers, glyphs, or drawings. Another may keep one enormous box
with nearly everything inside it.

Eskja does not judge one as more organized or correct.

### gathering

Future possibility: users may create their own organizing behavior.

The user manually arranges a set of eskjur and associates that
arrangement with a thing or mark of their choosing. Activating that
thing restores or toggles the gathering.

The system does not need to know that the arrangement is "alphabetical"
or "chronological." It remembers what the person did.

The existing `husbond` heart is the conceptual prototype: scattered
families gather into order when the heart is activated. The meaning is
personal and need not be explained by the software.

## eskja shop

Eskja Shop is distinct from ordinary print-on-demand.

A user selects a thing and chooses:

**make**

Then supplies only:

1.  size
2.  **"tell us about your thing. as much or as little detail as
    possible."**

### current size concept

-   small --- \$200 --- approximately 3×5 or 4×6 depending on the work
-   medium --- \$350 --- approximately 8×10 or 11×14
-   large --- \$500 --- approximately 16×20 or 16×24

Exact physical dimensions may depend on what the Shop makes.

### process

The user does not select medium, style, artist, finish, process, colors,
or materials.

Eskja Shop decides how the thing is made.

Possible outcomes include a photographic print with handwriting on the
reverse, a watercolor, a framed oil painting, multiple cyanotypes
assembled into a whole, a wooden cradleboard incorporating
paint/photos/text/objects, or other processes developed by the people
working in the Shop.

Examples of prior work show what is possible without promising how a
particular submitted thing will be made.

The Shop's purpose is not maximum margin or volume. It exists to
participate in helping people keep their things.

When the Shop is at capacity, the books close. It does not automate care
merely to increase throughput.

## deliberate refusals

Be suspicious of adding:

-   templates
-   themes
-   color customization as personality
-   profile pages
-   likes, comments, follows
-   engagement metrics
-   algorithmic feeds
-   popularity rankings
-   recommendation engines
-   automatic AI organization
-   AI interpretation of what a thing means
-   mandatory categories or titles
-   stock-image search
-   badges/gamification
-   onboarding tours explaining every interaction
-   constant tooltips
-   conventional folder trees as the primary representation
-   human-facing language that reduces things to files/assets/content
-   physical "smart object" gimmicks merely to technologize material
    things

Reliability, privacy, security, accessibility, backup, and preservation
are not optional merely because the surface is mysterious.

## current / near term

The immediate priority remains making the existing web application
beautiful, reliable, private, and useful for its original users.

Current/near-term capabilities: - blank spatial canvases - image
upload - GIF support - movable/resizable things - text things -
persistence - image grayscale control - image aging effect - audio
upload/simple playback (planned) - voice memo/simple playback
(planned) - mobile-friendly interaction (planned) - proper
authentication/private spaces (priority)

Do not let future ideas destabilize the working application
unnecessarily.

## later / unresolved

Interesting, not commitments: - nesting eskjur - user-created gathering
behaviors - deeper storeskja personalization through use -
physical/digital making loops - scanning front/back physical things -
preservation of multiple physical states over time - 3D things - native
Light OS / Android application - public wandering at meaningful scale -
Eskja Shop fulfillment and artist network

## decision log

**2026-08-10** - Use "thing" rather than file, asset, copy, avatar, or
imposed human-facing classification. - Eskja is the box/container; it is
not the thing. - Storeskja is the largest/home box and contains
eskjur. - Avoid labeling eskjur; an uploaded thing, glyph, drawing,
photograph, or text may itself be the entrance. - `+` and `&` are the
basic creation controls. - Context determines whether an added object
becomes an eskja entrance or a thing inside an eskja. - A star is the
wandering/navigation mark; it leads outward to another person's shared
space. - Shared spaces are framed spatially rather than labeled "someone
else's space." - Shared spaces may carry optional small gallery-like
name/note attribution. - No likes, comments, follows, subscriptions, or
engagement mechanics. - Structure should reflect personality through use
rather than customization settings. - `shop` is preferred conceptually
to `studio`. - Shop input is intentionally minimal: size plus "tell us
about your thing. as much or as little detail as possible." - Shop
process remains at the discretion of the maker. - Shop closes its books
when it cannot give submitted things appropriate care.


## v0.2 implementation decisions

- Replace the hourglass/aging control with local background removal on image things. Original is always preserved; the control toggles original/cutout. Glyph: overlapping stone forms.
- Eskja uses an open hand cursor for reaching/hovering and a grasping hand while dragging.
- Audio things are movable/resizable/deletable and use double imperfect rings with play / Isa pause; while playing, irregular ripples travel outward only.
- Video things are movable/resizable/deletable, retain saturation control, and use the same play / Isa language with a left-to-right progress ripple/track.
- One audible thing per eskja at a time. Starting another audio/video thing pauses the previous one.
- Internal vocabulary should move toward storeskja / eskja / thing as code is touched; do not rewrite the stable app merely for naming.
- Versioning: v0.1 is the known-good baseline. Sequential releases v0.2, v0.3, etc.; patch releases v0.2.1, etc.
