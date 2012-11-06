"""
$ python ordinal_numbers.py 1 4 Ave
1st Ave, 2nd Ave, 3rd Ave, 4th Ave

Usage: python ordinal_numbers.py START END [SUFFIX]
"""

import sys

SUFFIXES = {
    '1': 'st',
    '2': 'nd',
    '3': 'rd',
}

if __name__ == '__main__':
    number = int(sys.argv[1])
    while number <= int(sys.argv[2]):
        print "'" + str(number) + SUFFIXES.get(str(number), 'th'),
        print sys.argv[3] + "',",
        number += 1
