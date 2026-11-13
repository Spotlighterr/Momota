/*
 * Experimental GA401QC ASUS WMI Eco recovery. Default build only queries status.
 * The WMNB ABI is based on the public GA401 (2021) reference DSDT, not a dump
 * from the current machine. Confirm the installed firmware before a write trial.
 * No EC, GPIO, PCI register or firmware variable is written directly.
 */
DefinitionBlock ("", "SSDT", 2, "MOMOTA", "DGPUWMI", 0x00000001)
{
    External (\_SB.ATKD.WMNB, MethodObj)
    External (\_SB.PCI0.GPP0.PEGP, DeviceObj)

    Scope (\_SB)
    {
        Device (MRTG)
        {
            Name (_HID, "MOMT0001")
            Name (_UID, "GA401QC")
#ifdef MOMOTA_ENABLE_DGPU
            Name (ENAB, One)
#else
            Name (ENAB, Zero)
#endif
            Name (BEFR, 0xFFFFFFFF)
            Name (AFTR, 0xFFFFFFFF)
            Name (RSLT, 0xFFFFFFFF)
            // 0: not run, 1: queried, 2: write attempted, 3: re-queried.
            Name (STEP, Zero)

            Method (_STA, 0, NotSerialized)
            {
                If (_OSI ("Darwin"))
                {
                    If (CondRefOf (\_SB.ATKD.WMNB))
                    {
                        If (CondRefOf (\_SB.PCI0.GPP0.PEGP))
                        {
                            Return (0x0F)
                        }
                    }
                }
                Return (Zero)
            }

            Method (_INI, 0, Serialized)
            {
                // Keep initialization idempotent, including manual re-evaluation.
                If (STEP != Zero) { Return () }
                If (_STA () != 0x0F) { Return () }

                // Reference firmware creates DWORD fields through offset 0x10.
                // A short 8-byte WMI payload would overrun its last three fields.
                Local0 = Buffer (0x14) {0x20, 0x00, 0x09, 0x00}
                BEFR = \_SB.ATKD.WMNB (Zero, 0x53545344, Local0)
                AFTR = BEFR
                STEP = One

                // Only the explicit supported-and-Eco response permits a write.
                // Unknown, absent, Standard and unsupported responses stay query-only.
                If (ENAB == One)
                {
                    If (BEFR == 0x00010001)
                    {
                        STEP = 0x02
                        // Control DWORD at offset 4 remains zero: request Standard.
                        RSLT = \_SB.ATKD.WMNB (Zero, 0x53564544, Local0)
                        AFTR = \_SB.ATKD.WMNB (Zero, 0x53545344, Local0)
                        STEP = 0x03
                    }
                }
            }

            Method (_DSM, 4, NotSerialized)
            {
                If (Arg0 == ToUUID ("daffd814-6eba-4d8c-8a91-bc9bbf4aa301"))
                {
                    If (Arg2 == Zero) { Return (Buffer (One) {0x03}) }
                    If (Arg2 == One)
                    {
                        Return (Package ()
                        {
                            "momota-dgpu-write-enabled", ENAB,
                            "momota-dgpu-before", BEFR,
                            "momota-dgpu-after", AFTR,
                            "momota-dgpu-result", RSLT,
                            "momota-dgpu-step", STEP
                        })
                    }
                }
                Return (Buffer (One) {Zero})
            }
        }
    }
}
