#!/bin/bash

dir=db_release

#echo $dir

filenames=`ls -1v db_release/*.sql`

echo $filenames | sort -n

echo "************************"



for eachfile in $filenames

do

file="${eachfile##*/}"

echo $file

newversion=$(echo $file | sed -e 's|db_release_||g; s|.sql||g')

echo "Version in Repository : $newversion"


echo $service_name


        echo "Executing $service_name Master script"

        echo "New version to be integrated in Database : $newversion"

        psql -f $dir/$file

   echo "***************************************************************************************************************"

done
