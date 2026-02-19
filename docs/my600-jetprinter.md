MY600 Jet Printer -- Technical Overview
======================================

Introduction
------------

The **Mycronic MY600** is a high-precision solder paste **jet printing system** designed for stencil-free PCB assembly. Unlike traditional stencil printing, the MY600 deposits solder paste **volumetrically**, enabling dynamic, per-pad control of paste volume and geometry within a single print cycle.

* * * * *

Core Principle: Volumetric Jet Printing
---------------------------------------

The MY600 uses a piezo-driven ejector to dispense controlled droplets of solder paste onto PCB pads.

Instead of forcing paste through a fixed stencil aperture, the system:

-   Ejects controlled micro-droplets

-   Calculates required paste volume per pad

-   Deposits one or multiple droplets as needed

-   Builds final deposit geometry through droplet stacking and placement patterns

This enables precise and flexible solder paste deposition.

* * * * *

Dot Size Behavior
-----------------

### Dynamic Dot Control

The MY600 can change deposit size **for every individual pad on the board**, in real time, during the same print cycle.

It dynamically adjusts:

-   Droplet count per pad

-   Droplet volume (within ejector limits)

-   Dot spacing

-   Stacking pattern (vertical or lateral buildup)

This allows immediate transitions between small and large deposits without hardware changes.

* * * * *

Standard Ejector Dot Size Range
-------------------------------

With the **standard ejector**, typical printed dot diameters are approximately:

-   **Minimum:** ~0.33 mm (330 µm)

-   **Maximum:** ~0.52 mm (520 µm)

These values depend on:

-   Programmed paste volume

-   Jetting height

-   Paste type and rheology

-   Process settings

For smaller deposits, optional high-resolution ejectors may be available.

* * * * *

Two Levels of "Dot Size"
------------------------

It is important to distinguish between:

### 1\. Single Droplet Size

-   Defined by the ejector type and operating window

-   Adjustable within limits

-   Not infinitely variable

### 2\. Final Paste Deposit Size (on PCB)

-   Fully programmable per pad

-   Can consist of:

    -   A single droplet

    -   Multiple droplets

    -   Stacked droplets

    -   Patterned droplet arrays

-   Built to match required solder volume precisely

* * * * *

Advantages Over Stencil Printing
--------------------------------

The MY600 provides:

-   No stencil fabrication required

-   Instant design change flexibility

-   Per-pad volume customization

-   Support for mixed-technology boards

-   Fine control for prototypes and NPI

-   Elimination of step stencil complexity

-   On-the-fly optimization capability

* * * * *

Typical Use Cases
-----------------

-   Prototyping and small batch production

-   Frequent PCB revisions

-   Complex mixed-technology boards

-   QFN / BGA / center pad optimization

-   Low-volume, high-mix production

-   Stencil cost reduction strategies

* * * * *

Process Considerations
----------------------

Performance depends on:

-   Paste rheology

-   Environmental stability

-   Jetting height control

-   Machine calibration

-   Proper volume programming

Repeatability and process capability are typically very high when properly set up.

* * * * *

Summary
-------

The MY600 is a **dynamic, software-controlled solder paste deposition system**. It does not print a fixed dot size; instead, it adjusts deposit volume and geometry for every pad in real time within the physical limits of the ejector.

Its flexibility and precision make it a powerful alternative to stencil printing, especially in high-mix and prototype environments.