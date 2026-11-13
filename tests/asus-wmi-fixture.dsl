/* Synthetic firmware for ACPICA execution; never install in an EFI. */
#ifndef ECO_RESPONSE
#define ECO_RESPONSE 0x00010001
#endif
#ifndef WRITE_RESULT
#define WRITE_RESULT 1
#endif
#ifndef STUCK_ECO
#define STUCK_ECO 0
#endif
DefinitionBlock ("", "DSDT", 2, "MOMOTA", "WMI_TEST", 1)
{
    Name (WRIT, Zero)
    Name (READ, Zero)
    Name (BADS, Zero)
    Name (STAT, ECO_RESPONSE)
    Scope (\_SB)
    {
        Device (ATKD)
        {
            Name (_HID, "PNP0C14")
            Name (_UID, "ATK")
            Method (WMNB, 3, Serialized)
            {
                If ((SizeOf (Arg2) != 0x14) || (Arg0 != Zero))
                {
                    BADS++
                    Return (0xFFFFFFFE)
                }
                If (Arg2 != Buffer (0x14) {0x20, 0x00, 0x09, 0x00})
                {
                    BADS++
                    Return (0xFFFFFFFE)
                }
                If (Arg1 == 0x53545344)
                {
                    READ++
                    Return (STAT)
                }
                If (Arg1 == 0x53564544)
                {
                    WRIT++
#if WRITE_RESULT == 1 && STUCK_ECO == 0
                    STAT = 0x00010000
#endif
                    Return (WRITE_RESULT)
                }
                BADS++
                Return (0xFFFFFFFE)
            }
        }
        Device (PCI0)
        {
            Name (_HID, EisaId ("PNP0A08"))
            Name (_CID, EisaId ("PNP0A03"))
            Name (_UID, Zero)
            Device (GPP0)
            {
                Name (_ADR, 0x00010001)
                Device (PEGP) { Name (_ADR, Zero) }
            }
        }
    }
}
