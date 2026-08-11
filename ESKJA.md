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

## implementation batch — 2026-08-10

### internal language
- New implementation code should use `storeskja`, `eskja`, and `thing` where it describes the actual Eskja model.
- Existing `board` / `board_items` names remain only as legacy compatibility until their migrations are deliberate and safe.

### background removal
- Retire the hourglass/aging feature.
- Static image things receive a background-removal toggle.
- The original image is always preserved.
- Background removal runs on the user's device in the browser rather than through a remote inference API.
- Current implementation uses Transformers.js with an Apache-2.0 general-use ISNet ONNX model loaded lazily on first use.
- The resulting transparent PNG may be stored in Eskja so the state persists; processing itself stays local.
- GIF and video background removal are not part of this implementation.
- Glyph: two overlapping stone forms; rear stone outline, front stone solid.

### hand cursor
- Eskja's interactive cursor is an old engraved/sketched woman's hand with simple cloth cuff.
- Open hand = resting, hovering, reaching.
- Grasping hand = carrying/dragging a thing.
- Change is an immediate two-frame swap, not a smooth morph.
- Text and resize controls retain legible task-specific cursors where necessary.

### mark / favicon
- Use the selected simple white sketch of an eski/chest as the mark.
- Black ground; high contrast; deliberately simple enough to survive favicon size.
- No explanatory wordmark is required in the favicon.

### audio things
- `+` accepts MP3/M4A/WAV-class audio formats.
- Audio is a movable/resizable thing with the same `×` delete control.
- Play = hand-drawn wedge inside two imperfect rings.
- Pause = Isa-like single vertical stroke inside the same rings.
- While playing, a small family of imperfect rings is emitted outward from the source at slightly irregular intervals.
- Ripples always travel outward, never inward.

### video things
- `+` accepts common browser video formats.
- Video is movable/resizable and has the same `×` delete and saturation controls.
- Play/pause uses the same wedge / Isa language as audio.
- Instead of outward audio ripples, video has a quiet left-to-right duration line with an imperfect ripple marking current position.
- The ripple can be dragged to seek.
- Background removal is not offered for video.

### one voice
- One audible thing per eskja at a time.
- Starting another audio or video thing pauses the currently audible thing in the same eskja.
